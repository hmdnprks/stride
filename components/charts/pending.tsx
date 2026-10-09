"use client";

import { createContext, useContext } from "react";

/** True while a new date range loads; charts hold their last render, dimmed. */
export const TrendsPending = createContext(false);
export const useTrendsPending = () => useContext(TrendsPending);
