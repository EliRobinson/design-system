'use client';

import { Avatar } from '@elirobinson/react/components/atoms/Avatar';

export default function WithImage() {
  return (
    <div className="demo-row">
      <Avatar src="https://i.pravatar.cc/80?img=12" alt="Marcus Webb" fallback="MW" size="lg" />
      <Avatar alt="Marcus Webb" fallback="MW" size="lg" />
    </div>
  );
}
