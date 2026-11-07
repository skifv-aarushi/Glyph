'use client';

import React from 'react';
import { CleanLandingHub, CleanLandingHubProps } from './CleanLandingHub';

export type SessionBrowserProps = CleanLandingHubProps;

/**
 * SessionBrowser is an alias to CleanLandingHub, providing a refined,
 * human-centered developer session launcher and active directory.
 */
export const SessionBrowser: React.FC<SessionBrowserProps> = (props) => {
  return <CleanLandingHub {...props} />;
};

export default SessionBrowser;
