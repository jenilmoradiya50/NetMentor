import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';
import { TCP_HANDSHAKE_SCENARIO } from './tcp-handshake';

export { TCP_HANDSHAKE_SCENARIO };

export const PROTOCOL_SIMULATION_CATALOG: ProtocolSimulationScenario[] = [
  TCP_HANDSHAKE_SCENARIO,
];
