import { useCallback, useEffect, useRef, useState } from 'react';

export interface PageResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly offset: number;
}

export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

/**
 * Hook compartido para directorios paginados con filtros aplicados y protección de desmontaje.
 */
export function usePaginatedList<TItem, TFilters extends { readonly offset?: number | undefined }>({
  appliedFilters,
  pageSize,
  errorFallback,
  fetchPage,
}: {
  readonly appliedFilters: TFilters;
  readonly pageSize: number;
  readonly errorFallback: string;
  readonly fetchPage: (
    params: TFilters & { readonly limit: number; readonly offset: number },
  ) => Promise<PageResult<TItem>>;
}) {
  const [items, setItems] = useState<readonly TItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (filters: TFilters) => {
      setIsLoading(true);
      setRequestError(null);
      try {
        const page = await fetchPage({
          ...filters,
          limit: pageSize,
          offset: filters.offset ?? 0,
        });
        if (!mountedRef.current) return;
        setItems(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (error_) {
        if (mountedRef.current) {
          setRequestError(toErrorMessage(error_, errorFallback));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [errorFallback, fetchPage, pageSize],
  );

  useEffect(() => {
    void loadPage({ ...appliedFilters, offset: 0 });
  }, [appliedFilters, loadPage]);

  return {
    items,
    total,
    offset,
    isLoading,
    requestError,
    setRequestError,
    loadPage,
    mountedRef,
  };
}
