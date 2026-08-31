import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Plus, Package } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    low_stock_threshold: 10,
    unit: ''
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API}/inventory`);
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/inventory`, formData);
      toast.success('Item added!');
      setOpen(false);
      setFormData({ name: '', quantity: 0, low_stock_threshold: 10, unit: '' });
      fetchInventory();
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="inventory-page">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Inventory</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-item-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="add-item-dialog">
              <DialogHeader>
                <DialogTitle>Add Inventory Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-item-form">
                <div>
                  <Label>Item Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="item-name-input"
                  />
                </div>
                <div>
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    required
                    data-testid="item-quantity-input"
                  />
                </div>
                <div>
                  <Label>Low Stock Threshold *</Label>
                  <Input
                    type="number"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) })}
                    required
                    data-testid="item-threshold-input"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., boxes, units"
                    data-testid="item-unit-input"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="submit-item-button">
                  Add Item
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const isLowStock = item.quantity <= item.low_stock_threshold;
            return (
              <Card key={item.item_id} className="border-0 shadow-md" data-testid={`inventory-item-${item.item_id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isLowStock ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        <Package className={`h-5 w-5 ${
                          isLowStock ? 'text-red-600' : 'text-green-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        {isLowStock && (
                          <Badge variant="destructive" className="mt-1" data-testid={`low-stock-badge-${item.item_id}`}>
                            Low Stock
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-medium" data-testid={`item-quantity-${item.item_id}`}>{item.quantity} {item.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Threshold:</span>
                      <span>{item.low_stock_threshold} {item.unit}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {items.length === 0 && (
            <Card className="col-span-full border-0 shadow-md" data-testid="no-inventory">
              <CardContent className="p-12 text-center text-muted-foreground">
                No inventory items yet
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}