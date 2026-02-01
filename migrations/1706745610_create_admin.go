package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
		if err != nil {
			return err
		}

		existingAdmin, _ := app.FindAuthRecordByEmail(superusers, "admin@oracle.family")
		if existingAdmin != nil {
			return nil
		}

		admin := core.NewRecord(superusers)
		admin.SetEmail("admin@oracle.family")
		admin.SetPassword("oraclenet-admin-2026")

		return app.Save(admin)
	}, nil)
}
