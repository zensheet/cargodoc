-- Jalankan SEKALI; ganti <USER_ID_UUID> dengan id user di tabel profiles
insert into custom_field_definitions (user_id, field_key, field_label, applies_to, is_suggested, sort_order) values
  ('<USER_ID_UUID>', 'color',          'Color',           'both',         true, 1),
  ('<USER_ID_UUID>', 'material',       'Material',        'both',         true, 2),
  ('<USER_ID_UUID>', 'hs_code_extra',  'HS Code (extra)', 'invoice',      true, 3),
  ('<USER_ID_UUID>', 'shipping_marks', 'Shipping Marks',  'packing_list', true, 4);
