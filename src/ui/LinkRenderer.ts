import type { SessionControlLink } from "../types";
import { Logger } from "../utils/logger";

export interface PartitionedLinks {
  primary: SessionControlLink[];
  overflow: SessionControlLink[];
}

const MAX_PRIMARY = 2;
const logger = new Logger(false, "[gw-sdk]");

/**
 * Partition developer-supplied links into promoted (top-level) and
 * overflow (menu) slots. At most two links with `primary: true` are
 * promoted; excess promotions spill into overflow with a developer
 * warning so the config can be corrected.
 */
export function partitionLinks(
  links: SessionControlLink[] | undefined,
): PartitionedLinks {
  if (!links || links.length === 0) {
    return { primary: [], overflow: [] };
  }

  const primary: SessionControlLink[] = [];
  const overflow: SessionControlLink[] = [];

  for (const link of links) {
    if (link.primary && primary.length < MAX_PRIMARY) {
      primary.push(link);
    } else if (link.primary) {
      // Over the cap: spill into overflow and warn.
      logger.warn(
        `session-controls: at most ${MAX_PRIMARY} primary links are promoted; "${link.label}" spilled to overflow.`,
      );
      overflow.push({ ...link, primary: false });
    } else {
      overflow.push(link);
    }
  }

  return { primary, overflow };
}

/**
 * Build an HTMLAnchorElement for a link. External URLs (anything that
 * isn't same-origin) get `target="_blank"` + `rel="noopener noreferrer"`.
 */
export function renderLinkAnchor(
  link: SessionControlLink,
  className: string,
): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.className = className;
  anchor.href = link.href;
  anchor.textContent = link.label;

  if (isExternalHref(link.href)) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }

  if (link.icon) {
    const icon = document.createElement("span");
    icon.className = `${className}-icon`;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = link.icon;
    anchor.prepend(icon);
  }

  return anchor;
}

function isExternalHref(href: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    // Relative or malformed — treat as internal.
    return false;
  }
}
