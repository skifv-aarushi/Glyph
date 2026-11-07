'use client';

import React from 'react';
import { StickerPanel, StickerPanelProps } from '../stickers/StickerPanel';

export type StickerDrawerProps = StickerPanelProps;

export const StickerDrawer: React.FC<StickerDrawerProps> = (props) => {
  return <StickerPanel {...props} />;
};

export default StickerDrawer;
