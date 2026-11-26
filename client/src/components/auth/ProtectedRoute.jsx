/**
 * ChessIQ v3.3.0 — Protected Route Guard
 * Day 16 (@FE): Enforces backend session authentication before rendering protected views
 * (Personalized Training Puzzles, Longitudinal Analytics, User Game History).
 * Preserves intended destination across sign-in without losing navigation context.
 */

import React, { useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import LoginForm from "./LoginForm";
import AuthLoading from "./AuthLoading";

export default function ProtectedRoute({
  destination,
  destinationLabel,
  onAuthenticatedRedirect,
  children,
}) {
  const {
    isAuthenticated,
    isLoading,
    intendedDestination,
    setIntendedDestination,
  } = useAuth();

  useEffect(() => {
    if (
      !isLoading &&
      !isAuthenticated &&
      destination &&
      intendedDestination !== destination
    ) {
      setIntendedDestination(destination);
    }
  }, [
    isLoading,
    isAuthenticated,
    destination,
    intendedDestination,
    setIntendedDestination,
  ]);

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
        destinationLabel={destinationLabel}
        onSuccess={() => {
          const target = intendedDestination || destination;
          setIntendedDestination(null);
          if (onAuthenticatedRedirect && target) {
            onAuthenticatedRedirect(target);
          }
        }}
      />
    );
  }

  return <>{children}</>;
}
