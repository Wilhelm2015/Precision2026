
// This service has been decommissioned.
export const googleDriveService = {
  isConnected: () => false,
  connect: async () => {},
  disconnect: () => {},
  uploadReport: async () => { throw new Error('Cloud storage disabled'); }
};
