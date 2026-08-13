// Loads this design system into the template. In a consuming project, point
// base at the bound DS folder relative to this file (e.g. '_ds/<folder>' at
// the project root, '../_ds/<folder>' one level down) — one line to edit.
(() => {
  const base = '../..';
  for (const p of ["tokens/tokens.css","tokens/fonts.css","components/atoms/Avatar.css","components/atoms/Badge.css","components/atoms/Button.css","components/atoms/Checkbox.css","components/atoms/Eyebrow.css","components/atoms/Kbd.css","components/atoms/Progress.css","components/atoms/Separator.css","components/atoms/Skeleton.css","components/atoms/Slider.css","components/atoms/Spinner.css","components/atoms/Switch.css","components/atoms/field.css","components/molecules/Alert.css","components/molecules/Breadcrumb.css","components/molecules/Card.css","components/molecules/Chip.css","components/molecules/EmptyState.css","components/molecules/FormField.css","components/molecules/Pagination.css","components/molecules/Rating.css","components/molecules/RuleLink.css","components/molecules/SearchField.css","components/molecules/SegmentedControl.css","components/molecules/Stepper.css","components/organisms/Accordion.css","components/organisms/Combobox.css","components/organisms/CommandPalette.css","components/organisms/DatePicker.css","components/organisms/Dialog.css","components/organisms/DropdownMenu.css","components/organisms/NavigationMenu.css","components/organisms/Popover.css","components/organisms/Sheet.css","components/organisms/table-core.css","components/organisms/Table.css","components/organisms/VirtualList.css","components/organisms/VirtualTable.css","components/organisms/Tabs.css","components/organisms/Toast.css","components/organisms/Tooltip.css","components/organisms/chat.css","styles.css"]) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = base + '/' + p;
    document.head.appendChild(l);
  }
  const s = document.createElement('script');
  s.src = base + '/_ds_bundle.js';
  s.onerror = () => console.error('ds-base.js: failed to load ' + s.src + ' — if this is a consuming project, point the base line in ds-base.js at the bound _ds/<folder> tree relative to this page (e.g. _ds/<folder> at the project root, ../_ds/<folder> one level down); in a fresh design system this can just mean the bundle is not compiled yet');
  document.head.appendChild(s);
})();
