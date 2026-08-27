import { P3_COORDINATION_PORT_METHODS, type P3CoordinationPortProvider } from "../../p3/governed_evolution/coordination_port_contract.ts";
export const P4_P3_COORDINATION_BINDING=Object.freeze({port_ref:"q.p3.port.coordination_contract",contract_owner:"P3",provider_owner:"P3",client_owner:"P4",binding_owner:"P4",methods:P3_COORDINATION_PORT_METHODS} as const);
export function bindP3CoordinationPort(provider:P3CoordinationPortProvider):P3CoordinationPortProvider{return provider;}
