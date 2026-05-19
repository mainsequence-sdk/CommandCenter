import { useEffect, useMemo, useState } from "react";

type RegistrySelectionId = string | number;

function sameIds<Id extends RegistrySelectionId>(left: Id[], right: Id[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useRegistrySelection<T, Id extends RegistrySelectionId = number>(
  items: T[],
  getId: (item: T) => Id = ((item: { id: Id }) => item.id) as (item: T) => Id,
) {
  const [selectedIds, setSelectedIds] = useState<Id[]>([]);

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => getId(item)));

    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return sameIds(current, next) ? current : next;
    });
  }, [getId, items]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = items.filter((item) => selectedIdSet.has(getId(item)));
  const allSelected = items.length > 0 && items.every((item) => selectedIdSet.has(getId(item)));
  const someSelected = !allSelected && items.some((item) => selectedIdSet.has(getId(item)));

  return {
    allSelected,
    someSelected,
    selectedCount: selectedIds.length,
    selectedIds,
    selectedItems,
    clearSelection: () => setSelectedIds([]),
    isSelected: (id: Id) => selectedIdSet.has(id),
    setSelection: (ids: Id[]) => setSelectedIds(Array.from(new Set(ids))),
    toggleAll: () =>
      setSelectedIds((current) => {
        const currentSet = new Set(current);

        if (items.length > 0 && items.every((item) => currentSet.has(getId(item)))) {
          return [];
        }

        return items.map((item) => getId(item));
      }),
    toggleSelection: (id: Id) =>
      setSelectedIds((current) => {
        const currentSet = new Set(current);

        if (currentSet.has(id)) {
          currentSet.delete(id);
        } else {
          currentSet.add(id);
        }

        return Array.from(currentSet);
      }),
  };
}
