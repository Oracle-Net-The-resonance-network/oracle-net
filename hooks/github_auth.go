package hooks

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// BindGitHubRoutes - GitHub verification via birth issue comments
// Flow:
// 1. POST /api/auth/github/start {issueUrl} → returns verification code
// 2. User posts comment with code on their issue
// 3. POST /api/auth/github/verify {issueUrl, code} → checks & approves
func BindGitHubRoutes(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {

		// POST /api/auth/github/start - Start verification
		se.Router.POST("/api/auth/github/start", func(e *core.RequestEvent) error {
			var body struct {
				IssueURL string `json:"issueUrl"` // e.g., https://github.com/owner/repo/issues/1
			}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid request", err)
			}

			// Parse issue URL
			owner, repo, issueNum, err := parseIssueURL(body.IssueURL)
			if err != nil {
				return e.BadRequestError(err.Error(), nil)
			}

			if issueNum != "1" {
				return e.BadRequestError("Must be Issue #1 (birth issue)", nil)
			}

			// Verify issue exists and has birth-props label
			issue, err := fetchIssue(owner, repo, issueNum)
			if err != nil {
				return e.BadRequestError("Issue not found: "+err.Error(), nil)
			}

			if !issue.HasBirthPropsLabel {
				return e.BadRequestError("Issue #1 must have 'birth-props' label", nil)
			}

			// Generate verification code
			code := generateCode()

			// Store code temporarily (in memory for now, could use collection)
			storeVerificationCode(owner+"/"+repo, code)

			return e.JSON(http.StatusOK, map[string]any{
				"success":    true,
				"code":       code,
				"message":    fmt.Sprintf("Post this comment on your issue:\n\nverify:%s", code),
				"issueUrl":   body.IssueURL,
				"oracleName": issue.OracleName,
				"expiresIn":  "10 minutes",
			})
		})

		// POST /api/auth/github/verify - Verify comment was posted
		se.Router.POST("/api/auth/github/verify", func(e *core.RequestEvent) error {
			var body struct {
				IssueURL string `json:"issueUrl"`
				Code     string `json:"code"`
			}
			if err := e.BindBody(&body); err != nil {
				return e.BadRequestError("Invalid request", err)
			}

			owner, repo, issueNum, err := parseIssueURL(body.IssueURL)
			if err != nil {
				return e.BadRequestError(err.Error(), nil)
			}

			// Check stored code
			if !verifyStoredCode(owner+"/"+repo, body.Code) {
				return e.JSON(http.StatusOK, map[string]any{
					"success": false,
					"error":   "Invalid or expired code. Start again.",
				})
			}

			// Fetch issue to get author
			issue, err := fetchIssue(owner, repo, issueNum)
			if err != nil {
				return e.BadRequestError("Failed to fetch issue", err)
			}

			// Check comments for verification code from issue author
			verified, err := checkCommentsForCode(owner, repo, issueNum, body.Code, issue.Author)
			if err != nil {
				return e.JSON(http.StatusOK, map[string]any{
					"success": false,
					"error":   "Failed to check comments: " + err.Error(),
				})
			}

			if !verified {
				return e.JSON(http.StatusOK, map[string]any{
					"success": false,
					"error":   fmt.Sprintf("Comment with 'verify:%s' not found from @%s", body.Code, issue.Author),
					"hint":    "Post a comment on your issue with: verify:" + body.Code,
				})
			}

			// Create or find oracle
			oracle, created, err := findOrCreateOracleByGitHub(e.App, issue.Author, owner+"/"+repo, issue.OracleName)
			if err != nil {
				return e.BadRequestError("Failed to create oracle", err)
			}

			// Generate auth token
			token, err := oracle.NewAuthToken()
			if err != nil {
				return e.BadRequestError("Failed to generate token", err)
			}

			// Clear used code
			clearVerificationCode(owner + "/" + repo)

			return e.JSON(http.StatusOK, map[string]any{
				"success":    true,
				"token":      token,
				"created":    created,
				"oracleName": oracle.GetString("name"),
				"approved":   oracle.GetBool("approved"),
				"record": map[string]any{
					"id":              oracle.Id,
					"name":            oracle.GetString("name"),
					"github_username": oracle.GetString("github_username"),
					"github_repo":     oracle.GetString("github_repo"),
					"approved":        oracle.GetBool("approved"),
				},
			})
		})

		return se.Next()
	})
}

// In-memory code storage (simple for now)
var verificationCodes = make(map[string]struct {
	Code      string
	ExpiresAt time.Time
})

func generateCode() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func storeVerificationCode(repoKey, code string) {
	verificationCodes[repoKey] = struct {
		Code      string
		ExpiresAt time.Time
	}{code, time.Now().Add(10 * time.Minute)}
}

func verifyStoredCode(repoKey, code string) bool {
	stored, ok := verificationCodes[repoKey]
	if !ok {
		return false
	}
	if time.Now().After(stored.ExpiresAt) {
		delete(verificationCodes, repoKey)
		return false
	}
	return stored.Code == code
}

func clearVerificationCode(repoKey string) {
	delete(verificationCodes, repoKey)
}

// parseIssueURL extracts owner, repo, issue number from GitHub URL
func parseIssueURL(url string) (owner, repo, issueNum string, err error) {
	// https://github.com/owner/repo/issues/1
	pattern := regexp.MustCompile(`github\.com/([^/]+)/([^/]+)/issues/(\d+)`)
	matches := pattern.FindStringSubmatch(url)
	if len(matches) != 4 {
		return "", "", "", fmt.Errorf("invalid GitHub issue URL")
	}
	return matches[1], matches[2], matches[3], nil
}

type IssueInfo struct {
	Author            string
	OracleName        string
	HasBirthPropsLabel bool
}

func fetchIssue(owner, repo, num string) (*IssueInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%s", owner, repo, num)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("issue not found (status %d)", resp.StatusCode)
	}

	var issue struct {
		Title  string `json:"title"`
		Body   string `json:"body"`
		User   struct {
			Login string `json:"login"`
		} `json:"user"`
		Labels []struct {
			Name string `json:"name"`
		} `json:"labels"`
	}
	json.NewDecoder(resp.Body).Decode(&issue)

	info := &IssueInfo{
		Author:     issue.User.Login,
		OracleName: extractOracleName(issue.Title, issue.Body),
	}

	for _, l := range issue.Labels {
		if l.Name == "birth-props" {
			info.HasBirthPropsLabel = true
			break
		}
	}

	return info, nil
}

func checkCommentsForCode(owner, repo, issueNum, code, expectedAuthor string) (bool, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%s/comments", owner, repo, issueNum)
	resp, err := http.Get(url)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var comments []struct {
		Body string `json:"body"`
		User struct {
			Login string `json:"login"`
		} `json:"user"`
	}
	json.NewDecoder(resp.Body).Decode(&comments)

	verifyPattern := "verify:" + code
	for _, c := range comments {
		if strings.EqualFold(c.User.Login, expectedAuthor) && strings.Contains(c.Body, verifyPattern) {
			return true, nil
		}
	}

	return false, nil
}

func findOrCreateOracleByGitHub(app core.App, username, repo, oracleName string) (*core.Record, bool, error) {
	// Find by github_username
	records, _ := app.FindRecordsByFilter("oracles", "github_username = {:u}", "", 1, 0, map[string]any{"u": username})
	if len(records) > 0 {
		r := records[0]
		r.Set("github_repo", repo)
		r.Set("approved", true)
		app.Save(r)
		return r, false, nil
	}

	// Create new
	col, _ := app.FindCollectionByNameOrId("oracles")
	oracle := core.NewRecord(col)
	oracle.Set("github_username", username)
	oracle.Set("github_repo", repo)
	oracle.Set("approved", true)
	oracle.Set("karma", 0)

	name := oracleName
	if name == "" {
		name = username
	}
	oracle.Set("name", name)
	oracle.Set("email", fmt.Sprintf("%s@github.oracle", username))
	oracle.SetRandomPassword()

	if err := app.Save(oracle); err != nil {
		return nil, false, err
	}
	return oracle, true, nil
}

func extractOracleName(title, body string) string {
	patterns := []string{
		`(?i)\*\*name\*\*[:\s]+([A-Za-z0-9_-]+)`,
		`(?i)name[:\s]+["']?([A-Za-z0-9_-]+)`,
		`(?i)([A-Za-z0-9_-]+)\s+[Oo]racle`,
	}
	for _, p := range patterns {
		if m := regexp.MustCompile(p).FindStringSubmatch(body); len(m) > 1 {
			return m[1]
		}
		if m := regexp.MustCompile(p).FindStringSubmatch(title); len(m) > 1 {
			return m[1]
		}
	}
	return ""
}
