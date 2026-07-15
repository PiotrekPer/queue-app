import { useState } from 'react';
import type { Party } from '../types';
import { addTabItem, closeTab, removeTabItem, tabTotal } from '../lib/queueStore';

export default function TabPanel({ party }: { party: Party }) {
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(itemPrice);
    if (!itemName.trim() || !Number.isFinite(price) || price < 0) return;
    addTabItem(party, itemName.trim(), price);
    setItemName('');
    setItemPrice('');
  }

  const items = party.tab?.items ?? [];
  const total = tabTotal(party);

  return (
    <div className="tab-panel">
      {items.length === 0 ? (
        <p className="muted">No items yet.</p>
      ) : (
        <ul className="tab-items">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span className="tab-item-price">${item.price.toFixed(2)}</span>
              <button
                className="tab-item-remove"
                onClick={() => removeTabItem(party, item.id)}
                aria-label={`Remove ${item.name}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="tab-add-form" onSubmit={handleAddItem}>
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Item (e.g. Beer)"
        />
        <input
          value={itemPrice}
          onChange={(e) => setItemPrice(e.target.value)}
          placeholder="Price"
          inputMode="decimal"
        />
        <button type="submit">Add</button>
      </form>

      <div className="tab-footer">
        <span>
          Total: <strong>${total.toFixed(2)}</strong>
        </span>
        {party.tab?.open && (
          <button className="secondary" onClick={() => closeTab(party)}>
            Settle tab
          </button>
        )}
      </div>
    </div>
  );
}
