package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		// === HUMANS (auth collection) ===
		// Stores verified human users - separate from their Oracles
		humans := core.NewAuthCollection("humans")

		// Public read, auth users can create/update their own
		humans.ListRule = types.Pointer("")
		humans.ViewRule = types.Pointer("")
		humans.CreateRule = types.Pointer("")
		humans.UpdateRule = types.Pointer("@request.auth.id = id")
		humans.DeleteRule = types.Pointer("@request.auth.id = id")

		// Fields
		humans.Fields.Add(&core.TextField{
			Name:     "github_username",
			Required: false,
			Max:      100,
		})
		humans.Fields.Add(&core.TextField{
			Name:     "wallet_address",
			Required: false,
			Max:      42,
		})
		humans.Fields.Add(&core.TextField{
			Name:     "display_name",
			Required: false,
			Max:      100,
		})
		humans.Fields.Add(&core.DateField{
			Name:     "verified_at",
			Required: false,
		})

		if err := app.Save(humans); err != nil {
			return err
		}

		// Add unique indexes for wallet and github
		humans.AddIndex("idx_humans_wallet", true, "wallet_address", "wallet_address != ''")
		humans.AddIndex("idx_humans_github", true, "github_username", "github_username != ''")

		return app.Save(humans)
	}, func(app core.App) error {
		// Rollback: delete humans collection
		humans, err := app.FindCollectionByNameOrId("humans")
		if err != nil {
			return nil // Collection doesn't exist, nothing to rollback
		}
		return app.Delete(humans)
	})
}
