export const setCompanyId = (companyId) => ({
  type: "SET_COMPANY_ID",
  payload: companyId,
});

export const setCompanyError = (error) => ({
  type: "SET_COMPANY_ERROR",
  payload: error,
});
