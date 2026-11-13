/// <reference path="../types.d.ts" />

// Migration: Create Hearthlist collections
migrate(
  (app) => {
    // --- households collection ---
    const households = new Collection({
      name: "households",
      type: "base",
      fields: [
        { name: "name",        type: "text",   required: true,  min: 1, max: 60 },
        { name: "invite_code", type: "text",   required: true,  min: 6, max: 6, unique: true },
      ],
      createRule: null,          // superuser only (custom route)
      updateRule: null,          // superuser only
      deleteRule: null,          // superuser only
      listRule:   "@request.auth.id != '' && id = @request.auth.household",
      viewRule:   "@request.auth.id != '' && id = @request.auth.household",
    });
    app.save(households);

    // --- users auth collection (extends built-in) ---
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "display_name", required: true, min: 1, max: 40 }));
    users.fields.add(new RelationField({
      name: "household",
      collectionId: households.id,
      required: false,
      cascadeDelete: false,
    }));
    // List/view: self or same household
    users.listRule = "@request.auth.id != '' && (id = @request.auth.id || (household != '' && household = @request.auth.household))";
    users.viewRule = users.listRule;
    // Create: open sign-up
    users.createRule = "";
    // Update: self only; household not settable by clients
    users.updateRule = "@request.auth.id = id && @request.body.household:isset = false";
    // Delete: self only
    users.deleteRule = "@request.auth.id = id";
    app.save(users);

    // --- lists collection ---
    const lists = new Collection({
      name: "lists",
      type: "base",
      fields: [
        { name: "household",        type: "relation", collectionId: households.id, required: true },
        { name: "name",             type: "text",     required: true, min: 1, max: 80 },
        { name: "sort_order",       type: "number",   required: false },
        { name: "archived",         type: "bool",     required: false },
        { name: "created_by",       type: "relation", collectionId: users.id,      required: true },
        { name: "client_updated_at",type: "number",   required: false },
        { name: "deleted_at",       type: "number",   required: false },
      ],
      listRule:   "@request.auth.id != '' && household = @request.auth.household",
      viewRule:   "@request.auth.id != '' && household = @request.auth.household",
      createRule: "@request.auth.id != '' && @request.body.household = @request.auth.household",
      updateRule: "@request.auth.id != '' && household = @request.auth.household && @request.body.household:isset = false",
      deleteRule: null, // soft delete only
    });
    app.save(lists);

    // --- items collection ---
    const items = new Collection({
      name: "items",
      type: "base",
      fields: [
        { name: "list",       type: "relation", collectionId: lists.id,      required: true },
        { name: "household",  type: "relation", collectionId: households.id, required: true },
        { name: "name",       type: "text",     required: true, min: 1, max: 120 },
        { name: "quantity",   type: "number",   required: false },
        { name: "unit",       type: "text",     required: false, max: 12 },
        { name: "note",       type: "text",     required: false, max: 280 },
        { name: "category",   type: "text",     required: false, max: 40 },
        { name: "checked",    type: "bool",     required: false },
        { name: "checked_by", type: "relation", collectionId: users.id,      required: false },
        { name: "checked_at", type: "number",   required: false },
        { name: "content_at", type: "number",   required: true },
        { name: "state_at",   type: "number",   required: true },
        { name: "deleted_at", type: "number",   required: false },
        { name: "created_by", type: "relation", collectionId: users.id,      required: true },
      ],
      listRule:   "@request.auth.id != '' && household = @request.auth.household",
      viewRule:   "@request.auth.id != '' && household = @request.auth.household",
      createRule: "@request.auth.id != '' && @request.body.household = @request.auth.household",
      updateRule: "@request.auth.id != '' && household = @request.auth.household && @request.body.household:isset = false && @request.body.list:isset = false && @request.body.created_by:isset = false",
      deleteRule: null, // soft delete only
    });
    app.save(items);
  },

  // down migration (cleanup)
  (app) => {
    for (const name of ["items", "lists"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch {}
    }
    try {
      const users = app.findCollectionByNameOrId("users");
      users.fields.removeByName("display_name");
      users.fields.removeByName("household");
      app.save(users);
    } catch {}
    try { app.delete(app.findCollectionByNameOrId("households")); } catch {}
  }
);
