package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		// Create settings collection for admin toggles
		settings := core.NewBaseCollection("settings")

		// Only superusers can manage settings
		settings.ListRule = nil   // Superusers only
		settings.ViewRule = nil   // Superusers only
		settings.CreateRule = nil // Superusers only
		settings.UpdateRule = nil // Superusers only
		settings.DeleteRule = nil // Superusers only

		settings.Fields.Add(&core.TextField{
			Name:     "key",
			Required: true,
			Max:      100,
		})
		settings.Fields.Add(&core.TextField{
			Name: "value",
			Max:  1000,
		})
		settings.Fields.Add(&core.BoolField{
			Name: "enabled",
		})
		settings.Fields.Add(&core.TextField{
			Name: "description",
			Max:  500,
		})

		// Add unique index on key
		settings.AddIndex("idx_settings_key", true, "key", "")

		if err := app.Save(settings); err != nil {
			return err
		}

		// Seed default settings
		defaults := []struct {
			key         string
			value       string
			enabled     bool
			description string
		}{
			{
				key:         "allow_agent_registration",
				value:       "",
				enabled:     false,
				description: "Allow Oracle agents to self-register with their own wallet and birth issue",
			},
			{
				key:         "whitelisted_repos",
				value:       "Soul-Brews-Studio/*",
				enabled:     true,
				description: "Comma-separated list of repo patterns allowed for agent registration (e.g., 'owner/repo' or 'org/*')",
			},
		}

		for _, d := range defaults {
			record := core.NewRecord(settings)
			record.Set("key", d.key)
			record.Set("value", d.value)
			record.Set("enabled", d.enabled)
			record.Set("description", d.description)
			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, func(app core.App) error {
		// Delete settings collection on rollback
		settings, err := app.FindCollectionByNameOrId("settings")
		if err != nil {
			return nil // Collection might not exist
		}
		return app.Delete(settings)
	})
}

// GetSetting is a helper function to retrieve a setting value
func GetSetting(app core.App, key string) (*core.Record, error) {
	return app.FindFirstRecordByFilter("settings", "key = {:key}", map[string]any{"key": key})
}

// IsSettingEnabled checks if a boolean setting is enabled
func IsSettingEnabled(app core.App, key string) bool {
	record, err := GetSetting(app, key)
	if err != nil {
		return false
	}
	return record.GetBool("enabled")
}

// GetSettingValue returns the value of a setting
func GetSettingValue(app core.App, key string) string {
	record, err := GetSetting(app, key)
	if err != nil {
		return ""
	}
	return record.GetString("value")
}

// Helper to check if a repo matches whitelisted patterns
func IsRepoWhitelisted(app core.App, repoFullName string) bool {
	value := GetSettingValue(app, "whitelisted_repos")
	if value == "" {
		return false
	}

	// Parse comma-separated patterns
	patterns := types.JSONArray[string]{}
	for _, p := range splitAndTrim(value) {
		patterns = append(patterns, p)
	}

	return matchesAnyPattern(repoFullName, patterns)
}

func splitAndTrim(s string) []string {
	var result []string
	for _, p := range split(s, ",") {
		p = trim(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

func split(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if i+len(sep) <= len(s) && s[i:i+len(sep)] == sep {
			result = append(result, s[start:i])
			start = i + len(sep)
		}
	}
	result = append(result, s[start:])
	return result
}

func trim(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

func matchesAnyPattern(repo string, patterns types.JSONArray[string]) bool {
	for _, pattern := range patterns {
		if matchPattern(repo, pattern) {
			return true
		}
	}
	return false
}

func matchPattern(repo, pattern string) bool {
	// Handle wildcard patterns like "org/*"
	if len(pattern) > 0 && pattern[len(pattern)-1] == '*' {
		prefix := pattern[:len(pattern)-1]
		return len(repo) >= len(prefix) && repo[:len(prefix)] == prefix
	}
	// Exact match
	return repo == pattern
}
