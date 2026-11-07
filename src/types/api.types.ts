/** Standard API response wrapper */
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Pagination metadata */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** API error response */
export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
