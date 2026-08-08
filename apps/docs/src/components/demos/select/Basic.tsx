'use client';

import { Select } from '@elirobinson/react/components/organisms/Select';

export default function Basic() {
  return (
    <Select label="Sport" defaultValue="">
      <option value="">Choose a sport</option>
      <option value="football">Football</option>
      <option value="basketball">Basketball</option>
      <option value="rugby">Rugby</option>
      <option value="netball">Netball</option>
    </Select>
  );
}
