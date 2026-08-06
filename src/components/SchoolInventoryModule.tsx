/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ClassroomInventoryRecord, CustomInventoryItem } from '../types';
import { fetchSupabaseInventory, saveSupabaseInventory, deleteSupabaseInventoryRecord, getDeletedInventoryIds } from '../lib/supabase';
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  Printer,
  CheckCircle2,
  School,
  Bus,
  BookOpen,
  Armchair,
  Table,
  Droplets,
  Bath,
  RotateCcw,
  X,
  Save,
  Building2,
  Filter,
  Check,
  PackageCheck,
  AlertTriangle,
  Monitor,
  Tv,
  Tag
} from 'lucide-react';

export type { ClassroomInventoryRecord, CustomInventoryItem };

const DEFAULT_INVENTORY_DATA: ClassroomInventoryRecord[] = [
  { id: 'inv-complab', locationName: 'Computer Lab / ICT Centre', category: 'Facility', studentChairs: 40, studentTables: 20, textbooks: 50, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 2, teacherTables: 2, computers: 35, projectors: 2, customItems: [{ name: 'High-speed Fibre Router', quantity: 1 }, { name: 'UPS Power Backups', quantity: 12 }, { name: 'Interactive Whiteboard', quantity: 1 }], notes: '35 Desktop PCs, 2 Ceiling Projectors, High-speed Fibre Router & UPS Backups', updatedAt: new Date().toISOString() },
  { id: 'inv-n1', locationName: 'Nursery 1', category: 'Classroom', studentChairs: 25, studentTables: 12, textbooks: 50, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Toy Storage Bins', quantity: 4 }, { name: 'Foam Play Mats', quantity: 10 }], notes: 'Includes play mats and toy boxes', updatedAt: new Date().toISOString() },
  { id: 'inv-n2', locationName: 'Nursery 2', category: 'Classroom', studentChairs: 25, studentTables: 12, textbooks: 55, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Toy Storage Bins', quantity: 4 }], notes: 'Good condition', updatedAt: new Date().toISOString() },
  { id: 'inv-k1', locationName: 'Kindergarten 1', category: 'Classroom', studentChairs: 30, studentTables: 15, textbooks: 70, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Wall Clock', quantity: 1 }], notes: 'Newly repainted desks', updatedAt: new Date().toISOString() },
  { id: 'inv-k2', locationName: 'Kindergarten 2', category: 'Classroom', studentChairs: 30, studentTables: 15, textbooks: 75, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Magnetic Board', quantity: 1 }], notes: 'Standard setup', updatedAt: new Date().toISOString() },
  { id: 'inv-p1', locationName: 'Primary 1', category: 'Classroom', studentChairs: 35, studentTables: 18, textbooks: 110, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Whiteboard', quantity: 1 }], notes: 'NaCCA curriculum textbooks assigned', updatedAt: new Date().toISOString() },
  { id: 'inv-p2', locationName: 'Primary 2', category: 'Classroom', studentChairs: 35, studentTables: 18, textbooks: 115, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Whiteboard', quantity: 1 }], notes: 'Single desks', updatedAt: new Date().toISOString() },
  { id: 'inv-p3', locationName: 'Primary 3', category: 'Classroom', studentChairs: 38, studentTables: 19, textbooks: 120, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Science Demo Kits', quantity: 2 }, { name: 'Whiteboard', quantity: 1 }], notes: 'Science lab kits included', updatedAt: new Date().toISOString() },
  { id: 'inv-p4', locationName: 'Primary 4', category: 'Classroom', studentChairs: 40, studentTables: 20, textbooks: 130, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Whiteboard', quantity: 1 }], notes: 'Standard classroom', updatedAt: new Date().toISOString() },
  { id: 'inv-p5', locationName: 'Primary 5', category: 'Classroom', studentChairs: 40, studentTables: 20, textbooks: 135, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Smart Projection Screen', quantity: 1 }], notes: 'Includes 1 classroom PC and ceiling projector', updatedAt: new Date().toISOString() },
  { id: 'inv-p6', locationName: 'Primary 6', category: 'Classroom', studentChairs: 42, studentTables: 21, textbooks: 140, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Ceiling Fan', quantity: 4 }], notes: 'National exam preparation text library & smart projector', updatedAt: new Date().toISOString() },
  { id: 'inv-j1', locationName: 'JHS 1', category: 'Classroom', studentChairs: 45, studentTables: 45, textbooks: 180, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Wall Mounted Speakers', quantity: 2 }], notes: 'Individual study desks & presentation screen', updatedAt: new Date().toISOString() },
  { id: 'inv-j2', locationName: 'JHS 2', category: 'Classroom', studentChairs: 45, studentTables: 45, textbooks: 185, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Wall Mounted Speakers', quantity: 2 }], notes: 'Individual study desks & presentation screen', updatedAt: new Date().toISOString() },
  { id: 'inv-j3', locationName: 'JHS 3', category: 'Classroom', studentChairs: 45, studentTables: 45, textbooks: 200, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'BECE Revision Chart Stands', quantity: 3 }], notes: 'BECE preparation reference books & smart projector', updatedAt: new Date().toISOString() },
  { id: 'inv-staff', locationName: 'Staff Common Room', category: 'Administrative', studentChairs: 0, studentTables: 0, textbooks: 40, washrooms: 2, sinks: 3, buses: 0, teacherChairs: 18, teacherTables: 8, computers: 4, projectors: 1, customItems: [{ name: 'Water Dispenser', quantity: 1 }, { name: 'Microwave Oven', quantity: 1 }, { name: 'Heavy Duty Copier / Printer', quantity: 1 }], notes: 'Teacher lounge, conference table, 4 workstation PCs', updatedAt: new Date().toISOString() },
  { id: 'inv-admin', locationName: 'Admin & Principal Office', category: 'Administrative', studentChairs: 8, studentTables: 3, textbooks: 30, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 4, teacherTables: 4, computers: 5, projectors: 1, customItems: [{ name: 'Fireproof Vault Safe', quantity: 1 }, { name: 'Notice Board', quantity: 2 }], notes: 'Executive visitor chairs, office PCs & administrative printer setup', updatedAt: new Date().toISOString() },
  { id: 'inv-wash', locationName: 'Central Washroom Block', category: 'Facility', studentChairs: 0, studentTables: 0, textbooks: 0, washrooms: 12, sinks: 14, buses: 0, teacherChairs: 0, teacherTables: 0, computers: 0, projectors: 0, customItems: [{ name: 'Automated Hand Dryers', quantity: 4 }], notes: '6 Boys, 6 Girls, handwashing stations', updatedAt: new Date().toISOString() },
  { id: 'inv-transport', locationName: 'Transport Yard', category: 'Transport', studentChairs: 0, studentTables: 0, textbooks: 0, washrooms: 1, sinks: 2, buses: 4, teacherChairs: 0, teacherTables: 0, computers: 0, projectors: 0, customItems: [{ name: 'Emergency First Aid Kits', quantity: 4 }, { name: 'Fire Extinguishers', quantity: 4 }], notes: '4 Eastfield Academy School Buses with safety gear', updatedAt: new Date().toISOString() }
];

interface SchoolInventoryModuleProps {
  allSchoolClasses?: string[];
}

export default function SchoolInventoryModule({ allSchoolClasses = [] }: SchoolInventoryModuleProps) {
  const [inventory, setInventory] = useState<ClassroomInventoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ea_school_inventory') || localStorage.getItem('mock_supabase_ea_inventory');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading inventory from localStorage', e);
    }
    const isInitialized = localStorage.getItem('ea_inventory_initialized') === 'true' || localStorage.getItem('ea_inventory_seeded') === 'true';
    if (isInitialized) return [];
    return DEFAULT_INVENTORY_DATA;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClassroomInventoryRecord | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<ClassroomInventoryRecord | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [tableViewMode, setTableViewMode] = useState<'grouped' | 'itemized'>('grouped');

  // Form State
  const [formLocationName, setFormLocationName] = useState('');
  const [formCategory, setFormCategory] = useState<'Classroom' | 'Administrative' | 'Facility' | 'Transport' | 'Other'>('Classroom');
  const [formStudentChairs, setFormStudentChairs] = useState<number>(0);
  const [formStudentTables, setFormStudentTables] = useState<number>(0);
  const [formComputers, setFormComputers] = useState<number>(0);
  const [formProjectors, setFormProjectors] = useState<number>(0);
  const [formTextbooks, setFormTextbooks] = useState<number>(0);
  const [formWashrooms, setFormWashrooms] = useState<number>(0);
  const [formSinks, setFormSinks] = useState<number>(0);
  const [formBuses, setFormBuses] = useState<number>(0);
  const [formTeacherChairs, setFormTeacherChairs] = useState<number>(0);
  const [formTeacherTables, setFormTeacherTables] = useState<number>(0);
  const [formCustomItems, setFormCustomItems] = useState<CustomInventoryItem[]>([]);
  const [newCustomItemName, setNewCustomItemName] = useState('');
  const [newCustomItemQty, setNewCustomItemQty] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');

  // Initial Load from Supabase/Storage & Event Listeners for real-time sync
  useEffect(() => {
    let isMounted = true;
    const loadRemoteInventory = async () => {
      try {
        const remote = await fetchSupabaseInventory();
        if (remote && Array.isArray(remote) && isMounted) {
          setInventory(remote);
        }
      } catch (e) {
        console.warn('Failed syncing remote inventory', e);
      }
    };

    loadRemoteInventory();

    const handleSyncEvent = () => {
      try {
        const saved = localStorage.getItem('ea_school_inventory') || localStorage.getItem('mock_supabase_ea_inventory');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && isMounted) {
            setInventory(parsed);
          }
        }
      } catch (e) {}
    };

    const handleFocus = () => {
      loadRemoteInventory();
    };

    window.addEventListener('ea_inventory_updated', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);
    window.addEventListener('focus', handleFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadRemoteInventory();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic poll every 10s for real-time global multi-tab/device sync
    const pollInterval = setInterval(loadRemoteInventory, 10000);

    return () => {
      isMounted = false;
      window.removeEventListener('ea_inventory_updated', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Toast Helper
  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Metrics Calculation
  const totals = useMemo(() => {
    return inventory.reduce(
      (acc, item) => {
        acc.studentChairs += item.studentChairs || 0;
        acc.studentTables += item.studentTables || 0;
        acc.computers += item.computers || 0;
        acc.projectors += item.projectors || 0;
        acc.textbooks += item.textbooks || 0;
        acc.washrooms += item.washrooms || 0;
        acc.sinks += item.sinks || 0;
        acc.buses += item.buses || 0;
        acc.teacherChairs += item.teacherChairs || 0;
        acc.teacherTables += item.teacherTables || 0;
        if (item.customItems && Array.isArray(item.customItems)) {
          item.customItems.forEach(ci => {
            acc.customTotalQty += (ci.quantity || 0);
          });
        }
        return acc;
      },
      {
        studentChairs: 0,
        studentTables: 0,
        computers: 0,
        projectors: 0,
        textbooks: 0,
        washrooms: 0,
        sinks: 0,
        buses: 0,
        teacherChairs: 0,
        teacherTables: 0,
        customTotalQty: 0
      }
    );
  }, [inventory]);

  const grandTotalItems = useMemo(() => {
    return (
      totals.studentChairs +
      totals.studentTables +
      totals.computers +
      totals.projectors +
      totals.textbooks +
      totals.washrooms +
      totals.sinks +
      totals.buses +
      totals.teacherChairs +
      totals.teacherTables +
      totals.customTotalQty
    );
  }, [totals]);

  // Filtered List
  const filteredInventory = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    return inventory.filter(item => {
      const matchesSearch =
        !searchLower ||
        item.locationName.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        (item.notes && item.notes.toLowerCase().includes(searchLower)) ||
        (item.customItems && item.customItems.some(ci => ci.name.toLowerCase().includes(searchLower)));
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [inventory, searchTerm, selectedCategory]);

  // Custom Item Handlers
  const handleAddCustomItem = () => {
    const trimmed = newCustomItemName.trim();
    if (!trimmed) return;
    const qty = Math.max(1, Number(newCustomItemQty) || 1);
    setFormCustomItems(prev => [
      ...prev,
      {
        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmed,
        quantity: qty
      }
    ]);
    setNewCustomItemName('');
    setNewCustomItemQty(1);
  };

  const handleRemoveCustomItem = (index: number) => {
    setFormCustomItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCustomItemQty = (index: number, qty: number) => {
    setFormCustomItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: Math.max(0, qty) };
      return copy;
    });
  };

  const handleUpdateCustomItemName = (index: number, name: string) => {
    setFormCustomItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name };
      return copy;
    });
  };

  const handleAddBlankCustomRow = (initialName = '') => {
    setFormCustomItems(prev => [
      ...prev,
      {
        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: initialName,
        quantity: 1
      }
    ]);
  };

  // Open Modal for New Record
  const handleOpenNewModal = () => {
    setEditingRecord(null);
    setFormLocationName('');
    setFormCategory('Classroom');
    setFormStudentChairs(0);
    setFormStudentTables(0);
    setFormComputers(0);
    setFormProjectors(0);
    setFormTextbooks(0);
    setFormWashrooms(0);
    setFormSinks(0);
    setFormBuses(0);
    setFormTeacherChairs(0);
    setFormTeacherTables(0);
    setFormCustomItems([]);
    setNewCustomItemName('');
    setNewCustomItemQty(1);
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (rec: ClassroomInventoryRecord) => {
    setEditingRecord(rec);
    setFormLocationName(rec.locationName);
    setFormCategory(rec.category);
    
    // Consolidate existing standard items into formCustomItems array so admin sees all items in editable rows
    const consolidatedItems: CustomInventoryItem[] = [];
    if (rec.studentChairs > 0) consolidatedItems.push({ id: `c_sc_${rec.id}`, name: 'Student Chairs', quantity: rec.studentChairs });
    if (rec.studentTables > 0) consolidatedItems.push({ id: `c_st_${rec.id}`, name: 'Student Tables', quantity: rec.studentTables });
    if (rec.computers > 0) consolidatedItems.push({ id: `c_cp_${rec.id}`, name: 'Computers', quantity: rec.computers });
    if (rec.projectors > 0) consolidatedItems.push({ id: `c_pj_${rec.id}`, name: 'Projectors', quantity: rec.projectors });
    if (rec.textbooks > 0) consolidatedItems.push({ id: `c_tb_${rec.id}`, name: 'Textbooks', quantity: rec.textbooks });
    if (rec.washrooms > 0) consolidatedItems.push({ id: `c_wr_${rec.id}`, name: 'Washrooms', quantity: rec.washrooms });
    if (rec.sinks > 0) consolidatedItems.push({ id: `c_sk_${rec.id}`, name: 'Sinks', quantity: rec.sinks });
    if (rec.buses > 0) consolidatedItems.push({ id: `c_bs_${rec.id}`, name: 'Buses', quantity: rec.buses });
    if (rec.teacherChairs > 0) consolidatedItems.push({ id: `c_tc_${rec.id}`, name: 'Teacher Chairs', quantity: rec.teacherChairs });
    if (rec.teacherTables > 0) consolidatedItems.push({ id: `c_tt_${rec.id}`, name: 'Teacher Tables', quantity: rec.teacherTables });

    if (rec.customItems && Array.isArray(rec.customItems)) {
      rec.customItems.forEach((ci, idx) => {
        consolidatedItems.push({ ...ci, id: ci.id || `c_exist_${idx}_${Date.now()}` });
      });
    }

    if (consolidatedItems.length === 0) {
      consolidatedItems.push({ id: `c_${Date.now()}_1`, name: '', quantity: 1 });
    }

    setFormCustomItems(consolidatedItems);
    setNewCustomItemName('');
    setNewCustomItemQty(1);
    setFormNotes(rec.notes || '');
    setIsModalOpen(true);
  };

  // Prompt Delete Record Modal
  const handleDeleteRecord = (rec: ClassroomInventoryRecord) => {
    setDeleteConfirmRecord(rec);
  };

  // Execute Delete Record
  const executeDeleteRecord = async (record: ClassroomInventoryRecord) => {
    const updated = inventory.filter(item => item.id !== record.id);
    setInventory(updated);
    localStorage.setItem('ea_school_inventory', JSON.stringify(updated));
    localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify(updated));
    localStorage.setItem('ea_inventory_initialized', 'true');
    localStorage.setItem('ea_inventory_seeded', 'true');
    showNotification(`Deleted inventory record for ${record.locationName}`);
    setDeleteConfirmRecord(null);

    setIsSyncing(true);
    try {
      await deleteSupabaseInventoryRecord(record.id);
      await saveSupabaseInventory(updated, [record.id]);
    } catch (e) {
      console.warn('Error syncing deletion:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Prompt Reset to Defaults
  const handleResetDefaults = () => {
    setIsResetConfirmOpen(true);
  };

  // Execute Reset to Defaults
  const executeResetDefaults = async () => {
    localStorage.removeItem('ea_deleted_inventory_ids');
    setInventory(DEFAULT_INVENTORY_DATA);
    localStorage.setItem('ea_school_inventory', JSON.stringify(DEFAULT_INVENTORY_DATA));
    localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify(DEFAULT_INVENTORY_DATA));
    localStorage.setItem('ea_inventory_initialized', 'true');
    localStorage.setItem('ea_inventory_seeded', 'true');
    showNotification('Inventory reset to default values.');
    setIsResetConfirmOpen(false);

    setIsSyncing(true);
    try {
      await saveSupabaseInventory(DEFAULT_INVENTORY_DATA);
    } catch (e) {
      console.warn('Error resetting inventory:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Execute Delete All Inventory Records
  const executeDeleteAllInventory = async () => {
    const allIds = inventory.map(r => r.id);
    const currentDeleted = getDeletedInventoryIds();
    const combined = Array.from(new Set([...currentDeleted, ...allIds]));
    localStorage.setItem('ea_deleted_inventory_ids', JSON.stringify(combined));

    setInventory([]);
    localStorage.setItem('ea_school_inventory', JSON.stringify([]));
    localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify([]));
    localStorage.setItem('ea_inventory_initialized', 'true');
    localStorage.setItem('ea_inventory_seeded', 'true');
    showNotification('All inventory data has been deleted.');
    setIsDeleteAllConfirmOpen(false);

    setIsSyncing(true);
    try {
      await saveSupabaseInventory([], allIds);
    } catch (e) {
      console.warn('Error deleting all inventory records:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Submit Form (Save Add or Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLocationName.trim()) {
      alert('Please enter a valid Location/Classroom name.');
      return;
    }

    // Auto-add pending custom item if admin typed name but didn't click add
    let currentCustoms = [...formCustomItems];
    if (newCustomItemName.trim()) {
      currentCustoms.push({
        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: newCustomItemName.trim(),
        quantity: Math.max(1, Number(newCustomItemQty) || 1)
      });
      setNewCustomItemName('');
      setNewCustomItemQty(1);
    }

    let studentChairs = 0;
    let studentTables = 0;
    let computers = 0;
    let projectors = 0;
    let textbooks = 0;
    let washrooms = 0;
    let sinks = 0;
    let buses = 0;
    let teacherChairs = 0;
    let teacherTables = 0;
    const finalCustomItems: CustomInventoryItem[] = [];

    currentCustoms.forEach(row => {
      const trimmedName = row.name.trim();
      const qty = Math.max(0, Number(row.quantity) || 0);
      if (!trimmedName || qty <= 0) return;

      const lower = trimmedName.toLowerCase();
      if (lower === 'student chairs' || lower === 'student chair') {
        studentChairs += qty;
      } else if (lower === 'student tables' || lower === 'student table' || lower === 'student desks' || lower === 'student desk') {
        studentTables += qty;
      } else if (lower === 'computers' || lower === 'computer' || lower === 'desktop pcs & laptops') {
        computers += qty;
      } else if (lower === 'projectors' || lower === 'projector') {
        projectors += qty;
      } else if (lower === 'textbooks' || lower === 'textbook') {
        textbooks += qty;
      } else if (lower === 'washrooms' || lower === 'washroom') {
        washrooms += qty;
      } else if (lower === 'sinks' || lower === 'sink') {
        sinks += qty;
      } else if (lower === 'buses' || lower === 'bus' || lower === 'school buses') {
        buses += qty;
      } else if (lower === 'teacher chairs' || lower === 'teacher chair') {
        teacherChairs += qty;
      } else if (lower === 'teacher tables' || lower === 'teacher table' || lower === 'teacher desks' || lower === 'teacher desk') {
        teacherTables += qty;
      } else {
        finalCustomItems.push({
          id: row.id || `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: trimmedName,
          quantity: qty
        });
      }
    });

    const payload: ClassroomInventoryRecord = {
      id: editingRecord ? editingRecord.id : `inv-${Date.now()}`,
      locationName: formLocationName.trim(),
      category: formCategory,
      studentChairs,
      studentTables,
      computers,
      projectors,
      textbooks,
      washrooms,
      sinks,
      buses,
      teacherChairs,
      teacherTables,
      customItems: finalCustomItems,
      notes: formNotes.trim(),
      updatedAt: new Date().toISOString()
    };

    const currentDeleted = getDeletedInventoryIds();
    if (currentDeleted.includes(payload.id)) {
      const updatedDeleted = currentDeleted.filter(id => id !== payload.id);
      localStorage.setItem('ea_deleted_inventory_ids', JSON.stringify(updatedDeleted));
    }

    let updatedList: ClassroomInventoryRecord[];
    if (editingRecord) {
      updatedList = inventory.map(item => item.id === editingRecord.id ? payload : item);
      showNotification(`Updated inventory record for ${payload.locationName}`);
    } else {
      updatedList = [payload, ...inventory];
      showNotification(`Added new inventory record for ${payload.locationName}`);
    }

    setInventory(updatedList);
    setIsModalOpen(false);
    setEditingRecord(null);

    setIsSyncing(true);
    try {
      await saveSupabaseInventory(updatedList);
    } catch (err) {
      console.warn('Error saving inventory form:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Location / Classroom',
      'Category',
      'Student Chairs',
      'Student Tables',
      'Computers',
      'Projectors',
      'Custom / Additional Items',
      'Textbooks',
      'Washrooms',
      'Sinks',
      'Buses',
      'Teacher Chairs',
      'Teacher Tables',
      'Total Items Count',
      'Notes',
      'Last Updated'
    ];

    const rows = inventory.map(item => {
      const customFormatted = item.customItems && item.customItems.length > 0
        ? item.customItems.map(c => `${c.name}: ${c.quantity}`).join('; ')
        : 'None';

      const customQtySum = item.customItems
        ? item.customItems.reduce((s, c) => s + (c.quantity || 0), 0)
        : 0;

      const totalItemCount =
        (item.studentChairs || 0) +
        (item.studentTables || 0) +
        (item.computers || 0) +
        (item.projectors || 0) +
        customQtySum +
        (item.textbooks || 0) +
        (item.washrooms || 0) +
        (item.sinks || 0) +
        (item.buses || 0) +
        (item.teacherChairs || 0) +
        (item.teacherTables || 0);

      return [
        `"${item.locationName.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.studentChairs || 0,
        item.studentTables || 0,
        item.computers || 0,
        item.projectors || 0,
        `"${customFormatted.replace(/"/g, '""')}"`,
        item.textbooks || 0,
        item.washrooms || 0,
        item.sinks || 0,
        item.buses || 0,
        item.teacherChairs || 0,
        item.teacherTables || 0,
        totalItemCount,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
        `"${new Date(item.updatedAt).toLocaleDateString()}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eastfield_Academy_School_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast notification - text only, no text container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 text-emerald-800 font-black text-sm sm:text-base animate-bounce drop-shadow-md pointer-events-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-mauve-950 via-mauve-900 to-indigo-950 p-5 sm:p-6 rounded-2xl text-white border-2 border-amber-400/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300">
              <Boxes className="w-6 h-6" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Eastfield Academy School Inventory
            </h2>
          </div>
          <p className="text-xs text-mauve-200/90 max-w-2xl font-medium">
            Centralized property and asset register. Record chairs, tables, textbooks, washrooms, sinks, school buses, teacher furniture, and room equipment across all classrooms and facilities.
          </p>
        </div>

        <div className="flex items-center gap-2 wrap">
          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-mauve-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Inventory</span>
          </button>
          <button
            onClick={() => setIsDeleteAllConfirmOpen(true)}
            className="px-3.5 py-2.5 bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider rounded-xl border border-red-500 transition shadow-md flex items-center gap-2 cursor-pointer no-print"
            title="Delete All Recorded Data in Inventory"
          >
            <Trash2 className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Delete All Data</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-mauve-800 hover:bg-mauve-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-mauve-600 transition flex items-center gap-2 cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2.5 bg-mauve-800 hover:bg-mauve-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-mauve-600 transition flex items-center gap-2 cursor-pointer no-print"
            title="Print Inventory Summary"
          >
            <Printer className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>

      {/* SUM TOTAL METRICS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Chairs</span>
            <Armchair className="w-4 h-4 shrink-0 text-blue-300" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.studentChairs}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Student Chairs</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Tables</span>
            <Table className="w-4 h-4 shrink-0 text-blue-300" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.studentTables}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Student Desks</span>
        </div>

        <div className="p-3 rounded-xl bg-indigo-950/90 border-2 border-indigo-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-indigo-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Computers</span>
            <Monitor className="w-4 h-4 shrink-0 text-indigo-300" />
          </div>
          <div className="font-mono font-black text-indigo-100 text-xl sm:text-2xl my-0.5">
            {totals.computers}
          </div>
          <span className="text-[10px] text-indigo-200/90 font-medium truncate">PCs &amp; Laptops</span>
        </div>

        <div className="p-3 rounded-xl bg-purple-950/90 border-2 border-purple-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-purple-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Projectors</span>
            <Tv className="w-4 h-4 shrink-0 text-purple-300" />
          </div>
          <div className="font-mono font-black text-purple-100 text-xl sm:text-2xl my-0.5">
            {totals.projectors}
          </div>
          <span className="text-[10px] text-purple-200/90 font-medium truncate">AV / Screens</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Textbooks</span>
            <BookOpen className="w-4 h-4 shrink-0 text-blue-300" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.textbooks}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">School Books</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Washrooms</span>
            <Bath className="w-4 h-4 shrink-0 text-blue-300" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.washrooms}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Toilets / Cubicles</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Sinks</span>
            <Droplets className="w-4 h-4 shrink-0 text-blue-300" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.sinks}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Wash Taps</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Buses</span>
            <Bus className="w-4 h-4 shrink-0 text-blue-300" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.buses}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Fleet Vehicles</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Teacher Chairs</span>
            <Armchair className="w-4 h-4 text-amber-300 shrink-0" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.teacherChairs}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Staff Seating</span>
        </div>

        <div className="p-3 rounded-xl bg-blue-950/90 border-2 border-blue-400 text-white shadow-md flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between text-blue-300 mb-1 gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider truncate">Teacher Desks</span>
            <Table className="w-4 h-4 text-amber-300 shrink-0" />
          </div>
          <div className="font-mono font-black text-blue-100 text-xl sm:text-2xl my-0.5">
            {totals.teacherTables}
          </div>
          <span className="text-[10px] text-blue-200/90 font-medium truncate">Staff Desks</span>
        </div>

        <div className="p-3 rounded-xl bg-mauve-950 border-2 border-amber-400 text-white shadow-md flex flex-col justify-between col-span-2 min-h-[90px]">
          <div className="flex items-center justify-between text-amber-300 mb-1 gap-1">
            <span className="text-xs font-black uppercase tracking-wider truncate">Total Registered Assets</span>
            <PackageCheck className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="font-mono font-black text-amber-300 text-xl sm:text-2xl my-0.5">
            {grandTotalItems}
          </div>
          <span className="text-[10px] text-mauve-200/90 font-medium truncate">All School Equipment &amp; Furniture</span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-mauve-500/20 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search classroom or asset..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-mauve-900/30"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-gray-500 shrink-0" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-mauve-900/30"
          >
            <option value="ALL">All Categories ({inventory.length})</option>
            <option value="Classroom">Classrooms</option>
            <option value="Administrative">Administrative</option>
            <option value="Facility">Facilities &amp; Washrooms</option>
            <option value="Transport">Transport Fleet</option>
            <option value="Other">Other Locations</option>
          </select>

          <button
            onClick={handleResetDefaults}
            className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ml-1"
            title="Reset to initial default inventory"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden md:inline">Reset Defaults</span>
          </button>

          <button
            onClick={() => setIsDeleteAllConfirmOpen(true)}
            className="px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ml-1"
            title="Delete all recorded inventory items"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            <span className="hidden md:inline">Delete All Data</span>
          </button>
        </div>
      </div>

      {/* INVENTORY TABLE / CARDS LIST */}
      <div className="bg-white rounded-2xl border border-mauve-500/20 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-mauve-900" />
            <h3 className="font-extrabold text-base text-mauve-950 uppercase tracking-wider">
              Classroom &amp; Property Inventory Register ({filteredInventory.length})
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold hidden md:inline">View Mode:</span>
            <div className="inline-flex p-0.5 bg-gray-200/80 rounded-lg border border-gray-300">
              <button
                type="button"
                onClick={() => setTableViewMode('grouped')}
                className={`px-3 py-1.5 text-xs font-black rounded-md transition cursor-pointer ${
                  tableViewMode === 'grouped'
                    ? 'bg-mauve-950 text-amber-300 shadow-xs'
                    : 'text-gray-700 hover:text-mauve-950'
                }`}
              >
                Grouped Location
              </button>
              <button
                type="button"
                onClick={() => setTableViewMode('itemized')}
                className={`px-3 py-1.5 text-xs font-black rounded-md transition cursor-pointer ${
                  tableViewMode === 'itemized'
                    ? 'bg-mauve-950 text-amber-300 shadow-xs'
                    : 'text-gray-700 hover:text-mauve-950'
                }`}
              >
                Itemized (Location, Item, Qty)
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {tableViewMode === 'grouped' ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-blue-900 text-white font-black uppercase tracking-wide text-xs sm:text-sm shadow-sm">
                <tr>
                  <th className="py-3 px-3.5 text-left w-1/4 border-r border-blue-800 text-white font-black">LOCATION</th>
                  <th className="py-3 px-3.5 text-left w-5/12 border-r border-blue-800 text-white font-black">RECORDED ITEMS</th>
                  <th className="py-3 px-3.5 text-center w-1/6 border-r border-blue-800 text-white font-black">TOTAL QUANTITY</th>
                  <th className="py-3 px-3.5 text-left w-1/6 border-r border-blue-800 text-white font-black">NOTES</th>
                  <th className="py-3 px-3.5 text-center w-20 no-print text-white font-black">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 italic text-sm">
                      No matching inventory records found. Click &quot;Add New Inventory&quot; to record items.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map(item => {
                    const customQtySum = item.customItems
                      ? item.customItems.reduce((s, c) => s + (c.quantity || 0), 0)
                      : 0;
                    const totalQty =
                      (item.studentChairs || 0) +
                      (item.studentTables || 0) +
                      (item.computers || 0) +
                      (item.projectors || 0) +
                      (item.textbooks || 0) +
                      (item.washrooms || 0) +
                      (item.sinks || 0) +
                      (item.buses || 0) +
                      (item.teacherChairs || 0) +
                      (item.teacherTables || 0) +
                      customQtySum;

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                        {/* LOCATION */}
                        <td className="py-3 px-3.5 align-top border-r border-gray-100">
                          <div className="space-y-1">
                            <div className="font-black text-mauve-950 text-sm sm:text-base flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{item.locationName}</span>
                            </div>
                            <div>
                              <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-black uppercase ${
                                item.category === 'Classroom'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                  : item.category === 'Administrative'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : item.category === 'Facility'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  : item.category === 'Transport'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* RECORDED ITEMS */}
                        <td className="py-3 px-3.5 align-top border-r border-gray-100">
                          <div className="flex flex-wrap gap-1.5 max-w-xl">
                            {item.studentChairs > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-950 font-extrabold text-xs sm:text-sm border border-blue-200 shadow-2xs">
                                <Armchair className="w-4 h-4 text-blue-600" />
                                <span className="text-gray-900">Student Chairs:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.studentChairs}</span>
                              </span>
                            )}
                            {item.studentTables > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-950 font-extrabold text-xs sm:text-sm border border-blue-200 shadow-2xs">
                                <Table className="w-4 h-4 text-blue-600" />
                                <span className="text-gray-900">Student Tables:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.studentTables}</span>
                              </span>
                            )}
                            {item.computers > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-950 font-extrabold text-xs sm:text-sm border border-indigo-200 shadow-2xs">
                                <Monitor className="w-4 h-4 text-indigo-600" />
                                <span className="text-gray-900">Computers:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.computers}</span>
                              </span>
                            )}
                            {item.projectors > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-950 font-extrabold text-xs sm:text-sm border border-purple-200 shadow-2xs">
                                <Tv className="w-4 h-4 text-purple-600" />
                                <span className="text-gray-900">Projectors:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.projectors}</span>
                              </span>
                            )}
                            {item.textbooks > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-950 font-extrabold text-xs sm:text-sm border border-gray-300 shadow-2xs">
                                <BookOpen className="w-4 h-4 text-gray-600" />
                                <span className="text-gray-900">Textbooks:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.textbooks}</span>
                              </span>
                            )}
                            {item.washrooms > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-950 font-extrabold text-xs sm:text-sm border border-emerald-200 shadow-2xs">
                                <Bath className="w-4 h-4 text-emerald-600" />
                                <span className="text-gray-900">Washrooms:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.washrooms}</span>
                              </span>
                            )}
                            {item.sinks > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-950 font-extrabold text-xs sm:text-sm border border-sky-200 shadow-2xs">
                                <Droplets className="w-4 h-4 text-sky-600" />
                                <span className="text-gray-900">Sinks:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.sinks}</span>
                              </span>
                            )}
                            {item.buses > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-950 font-extrabold text-xs sm:text-sm border border-amber-300 shadow-2xs">
                                <Bus className="w-4 h-4 text-amber-600" />
                                <span className="text-gray-900">Buses:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.buses}</span>
                              </span>
                            )}
                            {item.teacherChairs > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-950 font-extrabold text-xs sm:text-sm border border-amber-300 shadow-2xs">
                                <Armchair className="w-4 h-4 text-amber-600" />
                                <span className="text-gray-900">Teacher Chair:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.teacherChairs}</span>
                              </span>
                            )}
                            {item.teacherTables > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-950 font-extrabold text-xs sm:text-sm border border-amber-300 shadow-2xs">
                                <Table className="w-4 h-4 text-amber-600" />
                                <span className="text-gray-900">Teacher Table:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{item.teacherTables}</span>
                              </span>
                            )}
                            {item.customItems && item.customItems.map((ci, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100/80 text-amber-950 font-extrabold text-xs sm:text-sm border border-amber-300 shadow-2xs">
                                <Tag className="w-4 h-4 text-amber-700" />
                                <span className="text-gray-900">{ci.name}:</span>
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md font-mono font-black text-xs sm:text-sm shadow-xs border border-blue-500">{ci.quantity}</span>
                              </span>
                            ))}
                            {totalQty === 0 && (
                              <span className="text-gray-400 text-xs italic">No items logged yet</span>
                            )}
                          </div>
                        </td>

                        {/* TOTAL QUANTITY - BLUE GRAPHICAL CONTAINER */}
                        <td className="py-3 px-3.5 text-center align-middle border-r border-gray-100">
                          <div className="inline-flex items-center justify-center px-3.5 py-1.5 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-mono font-black text-xs sm:text-sm shadow-md border border-blue-500 min-w-[90px]">
                            {totalQty} Items
                          </div>
                        </td>

                        {/* NOTES */}
                        <td className="py-3 px-3.5 text-xs sm:text-sm font-semibold text-gray-700 max-w-xs align-top border-r border-gray-100">
                          {item.notes || '—'}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 px-3.5 text-center align-middle no-print">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg transition cursor-pointer"
                              title="Edit Inventory"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(item)}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ITEMIZED FLAT TABLE VIEW: LOCATION, ITEM, QUANTITY */
            <table className="w-full text-left border-collapse">
              <thead className="bg-blue-900 text-white font-black uppercase tracking-wide text-xs sm:text-sm shadow-sm">
                <tr>
                  <th className="py-3 px-3.5 text-left w-1/3 border-r border-blue-800 text-white font-black">LOCATION</th>
                  <th className="py-3 px-3.5 text-left w-1/3 border-r border-blue-800 text-white font-black">ITEM NAME</th>
                  <th className="py-3 px-3.5 text-center w-1/6 border-r border-blue-800 text-white font-black">QUANTITY RECORDED</th>
                  <th className="py-3 px-3.5 text-center w-1/6 border-r border-blue-800 text-white font-black">CATEGORY</th>
                  <th className="py-3 px-3.5 text-center w-20 no-print text-white font-black">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium text-gray-800">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 italic text-sm">
                      No matching inventory records found.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.flatMap(record => {
                    const itemList: { name: string; qty: number; icon: any; colorClass: string }[] = [];
                    if (record.studentChairs > 0) itemList.push({ name: 'Student Chairs', qty: record.studentChairs, icon: Armchair, colorClass: 'text-blue-600' });
                    if (record.studentTables > 0) itemList.push({ name: 'Student Tables / Desks', qty: record.studentTables, icon: Table, colorClass: 'text-blue-600' });
                    if (record.computers > 0) itemList.push({ name: 'Desktop PCs & Laptops', qty: record.computers, icon: Monitor, colorClass: 'text-indigo-600' });
                    if (record.projectors > 0) itemList.push({ name: 'Projectors & Smart Screens', qty: record.projectors, icon: Tv, colorClass: 'text-purple-600' });
                    if (record.textbooks > 0) itemList.push({ name: 'Textbooks & Books', qty: record.textbooks, icon: BookOpen, colorClass: 'text-gray-700' });
                    if (record.washrooms > 0) itemList.push({ name: 'Washrooms / Toilets', qty: record.washrooms, icon: Bath, colorClass: 'text-emerald-600' });
                    if (record.sinks > 0) itemList.push({ name: 'Sinks & Wash Taps', qty: record.sinks, icon: Droplets, colorClass: 'text-sky-600' });
                    if (record.buses > 0) itemList.push({ name: 'School Buses & Vehicles', qty: record.buses, icon: Bus, colorClass: 'text-amber-600' });
                    if (record.teacherChairs > 0) itemList.push({ name: 'Teacher Chair', qty: record.teacherChairs, icon: Armchair, colorClass: 'text-amber-600' });
                    if (record.teacherTables > 0) itemList.push({ name: 'Teacher Table / Desk', qty: record.teacherTables, icon: Table, colorClass: 'text-amber-600' });
                    if (record.customItems) {
                      record.customItems.forEach(ci => {
                        if (ci.quantity > 0) {
                          itemList.push({ name: ci.name, qty: ci.quantity, icon: Tag, colorClass: 'text-amber-700' });
                        }
                      });
                    }

                    if (itemList.length === 0) {
                      return [
                        <tr key={`${record.id}-empty`} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3.5 font-black text-mauve-950 border-r border-gray-100 text-sm">{record.locationName}</td>
                          <td className="py-2.5 px-3.5 text-gray-400 italic border-r border-gray-100 text-sm">No items recorded</td>
                          <td className="py-2.5 px-3.5 text-center border-r border-gray-100">
                            <span className="inline-flex items-center justify-center px-3 py-1 bg-gray-200 text-gray-600 font-mono font-black text-xs sm:text-sm rounded-lg">0</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center text-gray-500 border-r border-gray-100 text-xs sm:text-sm">{record.category}</td>
                          <td className="py-2.5 px-3.5 text-center no-print">
                            <button onClick={() => handleOpenEditModal(record)} className="p-1.5 bg-blue-100 text-blue-900 rounded-lg cursor-pointer">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ];
                    }

                    return itemList.map((itemObj, i) => {
                      const IconComp = itemObj.icon;
                      return (
                        <tr key={`${record.id}-${i}`} className="hover:bg-blue-50/20 transition">
                          <td className="py-2.5 px-3.5 font-black text-mauve-950 border-r border-gray-100 text-sm sm:text-base">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{record.locationName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 font-extrabold text-gray-950 border-r border-gray-100 text-sm sm:text-base">
                            <div className="flex items-center gap-2">
                              <IconComp className={`w-4 h-4 ${itemObj.colorClass} shrink-0`} />
                              <span>{itemObj.name}</span>
                            </div>
                          </td>
                          {/* BLUE QUANTITY CONTAINER */}
                          <td className="py-2.5 px-3.5 text-center border-r border-gray-100 bg-blue-50/30">
                            <div className="inline-flex items-center justify-center px-4 py-1.5 bg-blue-600 text-white font-mono font-black text-xs sm:text-sm rounded-lg shadow-sm border border-blue-500 min-w-[60px]">
                              {itemObj.qty}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-center border-r border-gray-100">
                            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase bg-gray-100 text-gray-800 border border-gray-200">
                              {record.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center no-print">
                            <button
                              onClick={() => handleOpenEditModal(record)}
                              className="p-1.5 bg-blue-100 text-blue-900 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                              title="Edit Location Items"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border-2 border-blue-900 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between border-b border-blue-500">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  {editingRecord ? `Edit Inventory: ${editingRecord.locationName}` : 'Add New Classroom / Location Inventory'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-300 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-mauve-950 tracking-wider mb-1">
                    Location / Classroom Name * (Type any manual location)
                  </label>
                  <input
                    type="text"
                    required
                    list="inventory-locations-list"
                    placeholder="Type or select location (e.g. Primary 1, Staff Room, Bus Yard)"
                    value={formLocationName}
                    onChange={e => setFormLocationName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-mauve-950 focus:ring-2 focus:ring-mauve-900 outline-none placeholder:text-gray-400"
                  />
                  <datalist id="inventory-locations-list">
                    {allSchoolClasses.map(cls => (
                      <option key={cls} value={cls} />
                    ))}
                    <option value="Computer Lab / ICT Centre" />
                    <option value="Staff Common Room" />
                    <option value="Admin & Principal Office" />
                    <option value="Central Washroom Block" />
                    <option value="Transport Yard" />
                    <option value="Library" />
                    <option value="Science Lab" />
                    <option value="Dining Hall / Canteen" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-mauve-950 tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-mauve-950 focus:ring-2 focus:ring-mauve-900 outline-none"
                  >
                    <option value="Classroom">Classroom</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Facility">Facility / Washroom</option>
                    <option value="Transport">Transport Yard</option>
                    <option value="Other">Other Location</option>
                  </select>
                </div>
              </div>

              {/* FORM TABLE: MANUAL ITEM, LOCATION, QUANTITY ENTRY */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="block text-xs font-extrabold text-mauve-950 uppercase tracking-wider">
                      Inventory Items &amp; Asset List
                    </span>
                    <span className="text-[10px] text-gray-500 font-semibold block">
                      Type any item name and set quantity manually. No pre-filled restrictions.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddBlankCustomRow('')}
                      className="px-3 py-1.5 bg-mauve-950 hover:bg-mauve-900 text-amber-400 font-black text-xs uppercase rounded-lg shadow-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Item Row</span>
                    </button>
                  </div>
                </div>

                {/* Quick Suggestion Pills */}
                <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <span className="text-[9.5px] font-black uppercase text-gray-500">Quick Insert:</span>
                  {[
                    'Student Chairs',
                    'Student Tables',
                    'Computers',
                    'Projectors',
                    'Textbooks',
                    'Teacher Chairs',
                    'Teacher Tables',
                    'Whiteboard',
                    'Ceiling Fan',
                    'Air Conditioner',
                    'Printer',
                    'Sinks'
                  ].map(sug => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddBlankCustomRow(sug)}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 hover:text-amber-950 text-gray-700 font-bold text-[10px] rounded-md border border-gray-300/80 transition cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>

                <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-blue-900 text-white text-xs uppercase font-black tracking-wide border-b border-blue-500 shadow-xs">
                        <th className="py-3 px-3.5 border-r border-blue-800 w-1/3 text-amber-300 font-black">LOCATION</th>
                        <th className="py-3 px-3.5 border-r border-blue-800 w-5/12 text-white font-black">ITEM NAME</th>
                        <th className="py-3 px-3.5 border-r border-blue-800 text-center w-28 text-white font-black">QUANTITY</th>
                        <th className="py-3 px-2 text-center w-16 text-white font-black">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-xs font-medium text-gray-800">
                      {formCustomItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-gray-500 italic text-xs bg-gray-50">
                            No items added yet. Click &quot;+ Add Item Row&quot; above to insert inventory items manually.
                          </td>
                        </tr>
                      ) : (
                        formCustomItems.map((ci, idx) => (
                          <tr key={ci.id || idx} className="hover:bg-blue-50/20 transition">
                            <td className="py-2.5 px-3 font-black text-mauve-950 border-r border-gray-200 bg-gray-50/70 text-xs sm:text-sm">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>{formLocationName || 'Specified Location'}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-gray-200">
                              <div className="flex items-center gap-1.5">
                                <Tag className="w-4 h-4 text-amber-600 shrink-0" />
                                <input
                                  type="text"
                                  value={ci.name}
                                  onChange={e => handleUpdateCustomItemName(idx, e.target.value)}
                                  placeholder="Type item name (e.g. Student Chairs, Whiteboard, AC Unit)..."
                                  className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-extrabold text-mauve-950 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none placeholder:text-gray-400 placeholder:font-normal"
                                />
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-gray-200 bg-blue-50/40">
                              <input
                                type="number"
                                min="0"
                                value={ci.quantity}
                                onChange={e => handleUpdateCustomItemQty(idx, parseInt(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-blue-50 border-2 border-blue-400 rounded-lg text-sm sm:text-base font-black font-mono text-center text-blue-950 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none shadow-2xs"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomItem(idx)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="w-4 h-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddBlankCustomRow('')}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-mauve-950 font-black text-xs uppercase rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Another Row</span>
                  </button>
                  <span className="text-[10px] font-bold text-gray-500">
                    {formCustomItems.filter(ci => ci.name.trim()).length} active item row(s)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-mauve-950 tracking-wider mb-1">
                  Notes &amp; Equipment Condition
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Desks in good condition, missing 2 science workbooks..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-mauve-900 outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs uppercase rounded-xl border border-blue-500 shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-white" />
                  <span>Save Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-red-500 shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-mauve-950">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-gray-700">
              Are you sure you want to delete the inventory record for <strong className="text-mauve-950 font-bold">{deleteConfirmRecord.locationName}</strong>?
            </p>
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
              This action will permanently remove this record from both local memory and database sync.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteRecord(deleteConfirmRecord)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET DEFAULTS CONFIRMATION MODAL */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-amber-500 shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-amber-600">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-mauve-950">Reset to Default Inventory</h3>
            </div>
            <p className="text-sm text-gray-700">
              Are you sure you want to reset all inventory records back to factory default school items?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetDefaults}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-mauve-950 font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ALL CONFIRMATION MODAL */}
      {isDeleteAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-red-600 shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-mauve-950">Delete All Inventory Data</h3>
            </div>
            <p className="text-sm text-gray-700">
              Are you sure you want to permanently delete <strong>ALL {inventory.length} recorded inventory item(s)</strong>?
            </p>
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 font-semibold">
              Warning: This operation will wipe all classroom and facility inventory records across local storage and synchronized database. This action cannot be undone.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteAllConfirmOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteAllInventory}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete All Inventory Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
