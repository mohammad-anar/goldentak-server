export type IPaginationOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export interface IQueryParams {
  searchTerm?: string;
  sort?: string;
  page?: number;
  limit?: number;
  fields?: string;
  [key: string]: any;
}

export type IUserFilterRequest = {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  searchTerm?: string | undefined;
};