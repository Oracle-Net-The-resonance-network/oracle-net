package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		// Add claimed field (false = agent registered, not yet claimed by human)
		oracles.Fields.Add(&core.BoolField{
			Name: "claimed",
		})

		// Add agent_wallet (separate from human's wallet_address)
		// When an agent self-registers, this holds their wallet
		// When claimed, wallet_address holds human's wallet
		oracles.Fields.Add(&core.TextField{
			Name: "agent_wallet",
			Max:  42,
		})

		return app.Save(oracles)
	}, func(app core.App) error {
		oracles, err := app.FindCollectionByNameOrId("oracles")
		if err != nil {
			return err
		}

		// Remove fields on rollback
		oracles.Fields.RemoveByName("claimed")
		oracles.Fields.RemoveByName("agent_wallet")

		return app.Save(oracles)
	})
}
