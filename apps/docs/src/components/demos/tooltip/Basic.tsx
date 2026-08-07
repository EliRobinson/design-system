'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@elirobinson/react/components/organisms/Tooltip';

export default function Basic() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="secondary">Export as PDF</Button>
      </TooltipTrigger>
      <TooltipContent>Includes your session notes and the printable drill cards.</TooltipContent>
    </Tooltip>
  );
}
