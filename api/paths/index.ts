import type { ApiRequest, ApiResponse } from '../_lib/types';
import { requireAuth } from '../_lib/auth-guard';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Enforce server-side authentication
  const session = await requireAuth(req, res);
  if (!session) {
    return; // Response already sent by requireAuth
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Returns curriculum paths for authenticated user
  const paths = [
    {
      id: 'path-fund',
      slug: 'network-fundamentals',
      title: 'Network Fundamentals',
      description: 'OSI & TCP/IP models, IPv4/IPv6 addressing, subnetting, and switching fundamentals.',
      targetCert: 'Fundamentals',
      orderIndex: 1,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'path-ccna',
      slug: 'ccna-200-301',
      title: 'Cisco CCNA (200-301)',
      description: 'Routing protocols, OSPFv2/v3, VLANs, STP, EtherChannel, ACLs, NAT, and network security.',
      targetCert: 'CCNA',
      orderIndex: 2,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'path-ccnp',
      slug: 'ccnp-encor-350-401',
      title: 'Cisco CCNP Enterprise (ENCOR)',
      description: 'Enterprise architecture, advanced BGP, path selection, dual-stack routing, and SD-WAN.',
      targetCert: 'CCNP Enterprise',
      orderIndex: 3,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  return res.status(200).json({ paths });
}
