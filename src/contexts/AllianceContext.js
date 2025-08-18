import { createContext, useContext } from 'react';

const AllianceContext = createContext();

export const useAlliance = () => useContext(AllianceContext);

export default AllianceContext;
