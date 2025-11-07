import express from 'express';
import Agent from '../../models/Agent.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const agents = await Agent.findAll();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, prompt, type, use_case, phone_number, voice } = req.body;

    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required' });
    }

    const agent = await Agent.create({ name, prompt, type, use_case, phone_number, voice });
    res.status(201).json(agent);
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: `Failed to create agent: ${error.message}` });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, prompt, type, use_case, phone_number, voice } = req.body;
    const agent = await Agent.update(req.params.id, { name, prompt, type, use_case, phone_number, voice });
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Agent.delete(req.params.id);
    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

export default router;