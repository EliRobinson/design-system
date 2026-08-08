'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import { Toaster, useToast } from '@elirobinson/react/components/organisms/Toast';

function DownloadButton() {
  const { toast } = useToast();

  return (
    <Button
      onClick={() =>
        toast({
          title: 'Guide downloaded',
          description: 'Check your downloads folder for the PDF.',
        })
      }
    >
      Download guide
    </Button>
  );
}

export default function Basic() {
  return (
    <Toaster>
      <DownloadButton />
    </Toaster>
  );
}
