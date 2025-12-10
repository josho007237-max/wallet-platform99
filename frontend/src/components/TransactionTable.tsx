import React from 'react';

type Tx = {
  id: number;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
};

type Props = {
  items: Tx[];
};

export default function TransactionTable({ items }: Props) {
  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-2">Transactions</h2>
      <table className="min-w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 border">ID</th>
            <th className="px-2 py-1 border">Type</th>
            <th className="px-2 py-1 border">Amount</th>
            <th className="px-2 py-1 border">Status</th>
            <th className="px-2 py-1 border">Created At</th>
          </tr>
        </thead>
        <tbody>
          {items.map((tx) => (
            <tr key={tx.id}>
              <td className="px-2 py-1 border">{tx.id}</td>
              <td className="px-2 py-1 border">{tx.type}</td>
              <td className="px-2 py-1 border">{tx.amount}</td>
              <td className="px-2 py-1 border">{tx.status}</td>
              <td className="px-2 py-1 border">{tx.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
