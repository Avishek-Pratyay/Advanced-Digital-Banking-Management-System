import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./api";
import { requestStatusMiddleware } from "./middleware";
import account from "./slices/accountSlice";
import auth from "./slices/authSlice";
import loans from "./slices/loanSlice";
import transactions from "./slices/transactionSlice";
import ui from "./slices/uiSlice";

export const makeStore = () => {
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, auth, account, transactions, loans, ui },
    middleware: (getDefault) => getDefault().concat(api.middleware, requestStatusMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });
  setupListeners(store.dispatch);
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
