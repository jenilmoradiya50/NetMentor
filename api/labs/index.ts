import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import { JEREMY_PACKET_TRACER_LABS } from '../_lib/catalog/jeremy-ccna-catalog.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET is supported.' });
  }

  // Require authenticated session
  const session = await requireAuth(req, res);
  if (!session) return;

  return res.status(200).json({
    success: true,
    totalLabs: JEREMY_PACKET_TRACER_LABS.length,
    softwareRequirement: 'Cisco Packet Tracer 8.0+ (Free download via Cisco Networking Academy / SkillsForAll)',
    browserExecutionNotice: 'Packet Tracer (.pkt) simulation files contain proprietary Cisco network topologies and cannot be executed natively in a web browser. Download the lab topology and open it with your local Cisco Packet Tracer client to practice router and switch configurations.',
    labs: JEREMY_PACKET_TRACER_LABS,
  });
}
