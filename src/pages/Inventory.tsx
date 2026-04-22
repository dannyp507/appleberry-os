import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, where, writeBatch } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  Package,
  Filter,
  Barcode,
  Upload,
  Download,
  X,
  FileText,
  History
} from 'lucide-react';
import { Product } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import { useTenant } from '../lib/tenant';
import { withCompanyId } from '../lib/companyData';
import { useSearchParams } from 'react-router-dom';
import { companyQuery, requireCompanyId } from '../lib/db';
import { hasPermission } from '../lib/permissions';

const PAGE_SIZE = 100;

const ProductRow = memo(function ProductRow({
  product,
  onEdit,
  onDelete,
  canAdjustInventory,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  canAdjustInventory: boolean;
}) {
  return (
    <tr className="transition-colors group">
      <td className="px-6 py-4">
        <div>
          <p className="font-semibold text-white">{product.name}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {product.sku && <p className="badge badge-muted rounded-md px-1 py-0 text-[10px] font-mono">SKU: {product.sku}</p>}
            {product.barcode && <p className="badge badge-muted rounded-md px-1 py-0 text-[10px] font-mono">BC: {product.barcode}</p>}
            {product.imei && <p className="badge badge-info rounded-md px-1 py-0 text-[10px] font-mono">IMEI: {product.imei}</p>}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="badge badge-muted">
          {product.category}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm">
          <p className="font-bold text-white">{formatCurrency(product.selling_price)}</p>
          <p className="text-[10px] text-zinc-500">Cost: {formatCurrency(product.cost_price)}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-bold",
            product.stock <= product.low_stock_threshold ? "text-[#FCD34D]" : "text-white"
          )}>
            {product.stock}
          </span>
          {product.stock <= product.low_stock_threshold && (
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        {canAdjustInventory ? (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(product)}
              className="p-2 text-zinc-500 hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-all"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="p-2 text-zinc-500 hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">View only</span>
        )}
      </td>
    </tr>
  );
});

export default function Inventory() {
  const { companyId, profile } = useTenant();
  const canAdjustInventory = hasPermission(profile, 'inventory.adjust');
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false
  } as any);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    barcode: '',
    imei: '',
    cost_price: 0,
    selling_price: 0,
    stock: 0,
    low_stock_threshold: 5
  });

  useEffect(() => {
    fetchProducts();
  }, [companyId]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  async function fetchProducts() {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(companyQuery('products', companyId, orderBy('created_at', 'desc')));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
    } catch (error: any) {
      toast.error(error.message);
    }
    setLoading(false);
  }

  const handleOpenModal = (product?: Product) => {
    if (!canAdjustInventory) {
      toast.error('You do not have permission to adjust inventory.');
      return;
    }

    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        sku: product.sku || '',
        barcode: product.barcode || '',
        imei: product.imei || '',
        cost_price: product.cost_price,
        selling_price: product.selling_price,
        stock: product.stock,
        low_stock_threshold: product.low_stock_threshold
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category: '',
        sku: '',
        barcode: '',
        imei: '',
        cost_price: 0,
        selling_price: 0,
        stock: 0,
        low_stock_threshold: 5
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdjustInventory) {
      toast.error('You do not have permission to adjust inventory.');
      return;
    }
    
    // IMEI Duplicate Check
    if (formData.imei) {
      const q = companyQuery('products', companyId, where('imei', '==', formData.imei));
      const existing = await getDocs(q);
      
      const isDuplicate = existing.docs.some(d => d.id !== editingProduct?.id);
      
      if (isDuplicate) {
        toast.error('A product with this IMEI already exists');
        return;
      }
    }

    const workspaceId = requireCompanyId(companyId);
    const payload = withCompanyId(workspaceId, {
      ...formData,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      imei: formData.imei || null,
      updated_at: new Date().toISOString()
    });

    try {
      if (editingProduct) {
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, payload);
        toast.success('Product updated');
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          created_at: new Date().toISOString()
        });
        toast.success('Product added');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    if (!canAdjustInventory) {
      toast.error('You do not have permission to import inventory.');
      return;
    }

    setLoading(true);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let batch = writeBatch(db);
          const productsCol = collection(db, 'products');
          
          let count = 0;
          let totalCount = 0;
          for (const row of results.data as any[]) {
            const name = (row['Product name'] || '').trim();
            const productType = (row['Product Type'] || '').trim();
            const category = (row['Category name'] || productType || 'Uncategorized').trim();
            const manufacturer = (row['Manufacturer name'] || '').trim();
            const color = (row['Color Name'] || '').trim();
            const storage = (row['Storage'] || '').trim();
            const condition = (row['Physical Condition'] || '').trim();
            const externalId = (row['Id'] || '').trim() || null;
            const sku = (row['SKU'] || '').trim() || externalId;
            const costPrice = parseFloat(row['Cost price']) || 0;
            const sellingPrice = parseFloat(row['Selling Price']) || 0;
            const stock = parseInt(row['Current inventory']) || 0;
            const lowStock = parseInt(row['Minimum stock']) || 5;
            
            if (!name) continue;

            const newDoc = doc(productsCol);
            batch.set(newDoc, {
              company_id: requireCompanyId(companyId),
              name,
              category,
              sku,
              barcode: sku, // Using SKU/Id as barcode if not provided separately
              imei: null,
              cost_price: costPrice,
              selling_price: sellingPrice,
              stock: stock,
              low_stock_threshold: lowStock,
              external_id: externalId,
              product_type: productType || null,
              manufacturer: manufacturer || null,
              color: color || null,
              storage: storage || null,
              condition: condition || null,
              imported: true,
              import_batch: selectedFile.name,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            count++;
            totalCount++;

            if (count === 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }
          
          toast.success(`Successfully imported ${totalCount} products`);
          setIsImportModalOpen(false);
          setSelectedFile(null);
          fetchProducts();
        } catch (error: any) {
          toast.error('Import failed: ' + error.message);
        }
        setLoading(false);
      },
      error: (error) => {
        toast.error('Error parsing CSV file: ' + error.message);
        setLoading(false);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!canAdjustInventory) {
      toast.error('You do not have permission to delete products.');
      return;
    }

    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('Product deleted');
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: ['name', 'category', 'sku', 'barcode', 'imei'],
      threshold: 0.3,
      distance: 100,
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!deferredSearch.trim()) return products;
    return fuse.search(deferredSearch.trim()).map(result => result.item);
  }, [deferredSearch, products, fuse]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearch, products.length]);

  const hasMoreProducts = visibleProducts.length < filteredProducts.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">Stock Control</p>
          <h1 className="text-4xl font-black text-white">Products</h1>
          <p className="text-zinc-400 mt-2">Manage products, pricing, stock levels, SKU, barcode, and IMEI tracking.</p>
        </div>
        <div className="flex gap-2">
          {canAdjustInventory && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="btn btn-secondary"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="btn btn-primary"
              >
                <Plus className="w-5 h-5" />
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="section-card flex gap-4 p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode, or IMEI..."
            className="w-full pl-10 pr-4 py-2 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400 px-1">
        <p>
          Showing <span className="font-semibold text-white">{visibleProducts.length}</span> of{' '}
          <span className="font-semibold text-white">{filteredProducts.length}</span> products
        </p>
        {!!search.trim() && (
          <p className="text-zinc-500">
            Searching for <span className="font-semibold">“{search.trim()}”</span>
          </p>
        )}
      </div>

      {/* Product Table */}
      <div className="section-card rounded-xl overflow-hidden">
        <table className="ops-table w-full text-left">
          <thead>
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              [1,2,3,4,5].map(i => (
                <tr key={i} className="animate-pulse">
                <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-[#242429] rounded w-full"></div></td>
                </tr>
              ))
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No products found</p>
                </td>
              </tr>
            ) : (
              visibleProducts.map(product => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onEdit={handleOpenModal}
                  onDelete={handleDelete}
                  canAdjustInventory={canAdjustInventory}
                />
              ))
            )}
          </tbody>
        </table>

        {hasMoreProducts && (
          <div className="border-t border-gray-100 p-4 flex justify-center bg-[#fcfaf7]">
            <button
              onClick={() => setVisibleCount(current => current + PAGE_SIZE)}
              className="px-4 py-2 rounded-lg border border-[#e6d7c6] text-[#7b5c3c] font-medium hover:bg-white transition-all"
            >
              Load 100 more products
            </button>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <h2 className="text-xl font-bold">Import Products</h2>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setSelectedFile(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer",
                  isDragActive ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-gray-50",
                  selectedFile ? "border-green-500 bg-green-50" : ""
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    selectedFile ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
                  )}>
                    {selectedFile ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                  </div>
                  <div>
                    {selectedFile ? (
                      <>
                        <p className="font-bold text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-gray-900">
                          {isDragActive ? "Drop the file here" : "Click or drag CSV file to upload"}
                        </p>
                        <p className="text-sm text-gray-500">Only .csv files are supported</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedFile && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                  <div className="text-blue-600">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">Ready to import</p>
                    <p>The system will map your CSV columns to the product database. This process might take a few moments for large files.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || !selectedFile}
                  className="flex-1 appleberry-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Start Import
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="app-panel rounded-[28px] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[#e6d7c6] flex items-center justify-between bg-[#fbf4eb]">
              <h2 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU (Optional)</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode (Optional)</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.barcode}
                    onChange={e => setFormData({...formData, barcode: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IMEI (Optional)</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.imei}
                    onChange={e => setFormData({...formData, imei: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.cost_price}
                    onChange={e => setFormData({...formData, cost_price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.selling_price}
                    onChange={e => setFormData({...formData, selling_price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.low_stock_threshold}
                    onChange={e => setFormData({...formData, low_stock_threshold: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 appleberry-gradient text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
