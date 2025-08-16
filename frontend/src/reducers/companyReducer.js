const initialState = {
  companyId: null,
  error: null,
};

export default function companyReducer(state = initialState, action) {
  switch (action.type) {
    case "SET_COMPANY_ID":
      return { ...state, companyId: action.payload, error: null };
    case "SET_COMPANY_ERROR":
      return { ...state, companyId: null, error: action.payload };
    default:
      return state;
  }
}
