'use client';

import { Select } from '@elirobinson/react/components/organisms/Select';

export default function States() {
  return (
    <div className="demo-col">
      <Select label="Sport" hint="Filter guides by sport." defaultValue="">
        <option value="">Choose a sport</option>
        <option value="football">Football</option>
        <option value="basketball">Basketball</option>
        <option value="rugby">Rugby</option>
      </Select>
      <Select label="Sport" error="Choose a sport to see matching guides." defaultValue="">
        <option value="">Choose a sport</option>
        <option value="football">Football</option>
        <option value="basketball">Basketball</option>
        <option value="rugby">Rugby</option>
      </Select>
      <Select label="Sport" disabled defaultValue="football">
        <option value="football">Football</option>
        <option value="basketball">Basketball</option>
      </Select>
    </div>
  );
}
