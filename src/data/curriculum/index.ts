import type { DetailedTopic, DetailedLesson } from '../../types/curriculum.js';
import { CURRICULUM_PATHS } from './paths.js';

export { CURRICULUM_PATHS } from './paths.js';
export { lessonPacketWalk } from './fundamentals/packet-walk.js';
export { lessonSubnettingMagicNumber } from './fundamentals/subnetting.js';
export { lessonOspfNeighborStates } from './ccna/ospf-neighbor-states.js';
export { lessonBgpPathSelection } from './ccnp/bgp-path-selection.js';
export { lessonBgpTroubleshooting } from './ccnp/bgp-troubleshooting.js';
export { lessonSdWanArchitecture } from './ccnp/sd-wan-architecture.js';
export { lessonSdWanRoutingPolicy } from './ccnp/sd-wan-routing-policy.js';
export { lessonMplsL3Vpn } from './ccnp/mpls-l3vpn.js';
export { lessonQosFundamentals } from './ccnp/qos-fundamentals.js';

/**
 * Returns a flat list of all active curriculum lessons.
 */
export function getAllLessons(): DetailedLesson[] {
  const list: DetailedLesson[] = [];
  for (const p of CURRICULUM_PATHS) {
    for (const t of p.topics) {
      list.push(...t.lessons);
    }
  }
  return list;
}

/**
 * Finds a specific lesson by unique ID, returning lesson metadata and path/topic breadcrumb context.
 */
export function getLessonById(lessonId: string): {
  lesson: DetailedLesson;
  pathTitle: string;
  topicTitle: string;
  pathId: string;
  topicId: string;
} | null {
  for (const p of CURRICULUM_PATHS) {
    for (const t of p.topics) {
      const found = t.lessons.find((l) => l.id === lessonId);
      if (found) {
        return {
          lesson: found,
          pathTitle: p.title,
          topicTitle: t.title,
          pathId: p.id,
          topicId: t.id,
        };
      }
    }
  }
  return null;
}

/**
 * Finds a specific topic module by ID.
 */
export function getTopicById(topicId: string): DetailedTopic | null {
  for (const p of CURRICULUM_PATHS) {
    const found = p.topics.find((t) => t.id === topicId);
    if (found) return found;
  }
  return null;
}
