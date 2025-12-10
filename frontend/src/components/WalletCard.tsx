import React from 'react';

type Props = {
  available: number;
  locked: number;
};

export default function WalletCard({ available, locked }: Props) {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      <h2 className="text-lg font-semibold mb-2">Wallet Balance</h2>
      <p className="text-sm text-gray-600">Available</p>
      <p className="text-2xl font-bold mb-2">{available.toFixed(2)} THB</p>
      <p className="text-sm text-gray-600">Locked</p>
      <p className="text-xl font-semibold">{locked.toFixed(2)} THB</p>
    </div>
  );
}
