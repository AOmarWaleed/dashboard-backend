export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

export const getPagination = (page, limit) => ({
  pageNum: parseInt(page, 10) || DEFAULT_PAGE,
  limitNum: parseInt(limit, 10) || DEFAULT_LIMIT,
});
