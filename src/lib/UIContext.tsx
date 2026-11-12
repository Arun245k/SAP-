import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
  isAutonomousEnabled: boolean;
  setIsAutonomousEnabled: (val: boolean) => void;
  isPredictiveEnabled: boolean;
  setIsPredictiveEnabled: (val: boolean) => void;
  isAdaptiveEngineEnabled: boolean;
  setIsAdaptiveEngineEnabled: (val: boolean) => void;
  isSpatialUiEnabled: boolean;
  setIsSpatialUiEnabled: (val: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isAutonomousEnabled, setIsAutonomousEnabled] = useState(true);
  const [isPredictiveEnabled, setIsPredictiveEnabled] = useState(true);
  const [isAdaptiveEngineEnabled, setIsAdaptiveEngineEnabled] = useState(true);
  const [isSpatialUiEnabled, setIsSpatialUiEnabled] = useState(true);

  return (
    <UIContext.Provider value={{
      isAutonomousEnabled, setIsAutonomousEnabled,
      isPredictiveEnabled, setIsPredictiveEnabled,
      isAdaptiveEngineEnabled, setIsAdaptiveEngineEnabled,
      isSpatialUiEnabled, setIsSpatialUiEnabled
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
