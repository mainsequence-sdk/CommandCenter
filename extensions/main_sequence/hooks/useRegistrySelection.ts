import { useEffect, useMemo, useState } from "react";

function sameIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useRegistrySelection<T extends { id: number }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id));

    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return sameIds(current, next) ? current : next;
    });
  }, [items]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = items.filter((item) => selectedIdSet.has(item.id));
  const allSelected = items.length > 0 && items.every((item) => selectedIdSet.has(item.id));
  const someSelected = !allSelected && items.some((item) => selectedIdSet.has(item.id));

  return {
    allSelected,
    someSelected,
    selectedCount: selectedIds.length,
    selectedIds,
    selectedItems,
    clearSelection: () => setSelectedIds([]),
    isSelected: (id: number) => selectedIdSet.has(id),
    setSelection: (ids: number[]) => setSelectedIds(Array.from(new Set(ids))),
    toggleAll: () =>
      setSelectedIds((current) => {
        const currentSet = new Set(current);

        if (items.length > 0 && items.every((item) => currentSet.has(item.id))) {
          return [];
        }

        return items.map((item) => item.id);
      }),
    toggleSelection: (id: number) =>
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
