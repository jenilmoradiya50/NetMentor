import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';
import { TCP_HANDSHAKE_SCENARIO } from './tcp-handshake';
import { ARP_MAC_LEARNING_SCENARIO } from './arp-mac-learning';
import { OSPF_ADJACENCY_SCENARIO } from './ospf-adjacency';

export {
  TCP_HANDSHAKE_SCENARIO,
  ARP_MAC_LEARNING_SCENARIO,
  OSPF_ADJACENCY_SCENARIO,
};

export const PROTOCOL_SIMULATION_CATALOG: ProtocolSimulationScenario[] = [
  TCP_HANDSHAKE_SCENARIO,
  ARP_MAC_LEARNING_SCENARIO,
  OSPF_ADJACENCY_SCENARIO,
];
