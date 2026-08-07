'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@elirobinson/react/components/organisms/Tooltip';

export default function IconButton() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="ghost" aria-label="Download guide">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 1v9m0 0 3-3m-3 3-3-3M2 12v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Download guide</TooltipContent>
    </Tooltip>
  );
}
