import { PickerField, type PickerFieldProps, type PickerOption } from "./PickerField";

export type MainSequenceDataSourcePickerFieldProps = Omit<PickerFieldProps, "options"> & {
  options: PickerOption[];
};

function ensureDataSourceOptionVisual(option: PickerOption): PickerOption {
  return {
    ...option,
    fallbackIcon: option.fallbackIcon ?? "database",
  };
}

export function MainSequenceDataSourcePickerField({
  options,
  ...props
}: MainSequenceDataSourcePickerFieldProps) {
  return (
    <PickerField
      {...props}
      options={options.map(ensureDataSourceOptionVisual)}
    />
  );
}
