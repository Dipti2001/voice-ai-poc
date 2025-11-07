import express from 'express';
import Contact from '../../models/Contact.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || null;
    const contacts = await Contact.findAll(limit, search);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const contacts = await Contact.getCallHistory(limit);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone_number, email, company, notes, tags } = req.body;

    if (!name || !phone_number) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    // Check if phone number already exists
    const existingContact = await Contact.findByPhoneNumber(phone_number);
    if (existingContact) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }

    const contact = await Contact.create({
      name,
      phone_number,
      email,
      company,
      notes,
      tags: tags ? JSON.stringify(tags) : null
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone_number, email, company, notes, tags } = req.body;

    // Check if phone number conflicts with another contact
    const existingContact = await Contact.findByPhoneNumber(phone_number);
    if (existingContact && existingContact.id !== req.params.id) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }

    const contact = await Contact.update(req.params.id, {
      name,
      phone_number,
      email,
      company,
      notes,
      tags: tags ? JSON.stringify(tags) : null
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Contact.delete(req.params.id);
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

export default router;