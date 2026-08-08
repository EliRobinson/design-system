'use client';

import { Slider } from '@elirobinson/react/components/atoms/Slider';

export default function Basic() {
  return <Slider label="Volume" min={0} max={100} defaultValue={50} />;
}
