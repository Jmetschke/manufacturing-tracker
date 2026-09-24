# Equipment and Ingredient Inventory

The admin Ordered Items tab contains one expandable Item Mapping area. It offers grouped unmapped descriptions, a standard-item catalog, and existing mappings grouped under each catalog item. Regular signed-in users can select or create catalog definitions from the existing Locations Add Item form. Mapping assignment, removal, and renaming are admin-only.

This catalog is separate from manufacturing `items` and Metrc aliases. Orders, calendar deliveries, receiving, and room inventory display the standard name when mapped, while order/room details retain the original description. Existing receiving, editing, date-setting, moving, and deleting actions remain in use.

## Storage and migration

- `standard_items`: stable IDs, names, and unique case-insensitive name keys.
- `item_aliases`: standard-item ID, original vendor/description, deterministic vendor/description keys, and optional SKU/manufacturer/model fields for future structured parser data.
- `ordered_items.original_description` and `.original_supplier`: snapshot existing values once. An insert trigger captures every new order, including imports and manual entries. An update trigger prevents overwriting those snapshots.
- `storage_items.standard_item_id` and `.units_per_package`: optional additions for manually entered room inventory.
- `storage_delivery_quantities`: current room quantity and optional items per package for received order lines. These overrides travel with the order ID when it moves rooms.

All changes are additive and idempotent. Previously overwritten descriptions cannot be recovered; legacy records preserve the current stored text as their source snapshot. Source capture preserves the description output by the existing PDF parser, not raw PDF layout or files.

Mappings use exact vendor + description matching after SQL `lower(trim(...))`; no fuzzy matching, punctuation removal, SKU guessing, or cross-vendor inference. The current parser does not expose dependable structured SKUs. The original unnormalized description is never rewritten. Association is resolved by indexed alias lookup rather than copying a mutable standard name or mapping ID onto every order. Creating, changing, or removing an alias immediately affects all applicable existing and future orders. A standard-item rename preserves its ID and mappings.

Unmapped orders continue through importing, scheduling, and receiving normally. Mapping removal does not delete source orders, received records, or room placement records.

## Quantities

Receiving reuses the existing `ordered_items.units_per_package` field. It is optional; blank means unknown. Old clients omitting it preserve its previous value. The current workflow still receives one whole order line into one location; partial receiving and individual asset serial numbers are not introduced.

Room edits can change current quantity and items per package, including setting quantity to zero or clearing the optional package size. Received-order adjustments are stored separately from invoice quantity and the recorded receiving package size. Manual entries update their own inventory row. Where quantity is explicitly packages/boxes/cases/packs, the display also shows the calculated item total. No item total is inferred for units such as pounds.

Undoing receipt clears the room quantity override. Deleting an order clears its quantity and placement overrides. Mapping changes do not affect these values.

## Verification

`node --test tests/*.test.cjs` with Node 22.13+ includes an isolated SQLite workflow test covering migration reruns, import-handler fixtures, repeated descriptions, shared definitions across vendors, original-description protection, mapped receiving, manual inventory, quantity overrides across a room move, optional package sizes, invalid values, renaming, reassignment, and mapping removal.

Browser checks run against both actual page scripts with simulated API responses to verify mapping controls (admin), receiving package size, room quantity editing, catalog selection, and blank optional values. No production records were changed for these checks.
