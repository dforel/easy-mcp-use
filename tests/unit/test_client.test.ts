import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { MCPClient } from '../../src/client';
import { MCPClientConfig } from '@/config';


describe('TestMCPClientInitialization', () => {
  describe('test_init_empty', () => {
    it('should initialize with empty config', () => {
      const client = new MCPClient();
      expect(client.config).toEqual({"mcpServers":  {}});
      expect(client.sessions).toEqual({});
      expect(client.activeSessions).toEqual([]);
    });
  });

  describe('test_init_with_dict_config', () => {
    it('should initialize with dictionary config', () => {
      const config = { mcpServers: { test: { url: 'http://test.com' } } };
      const client = new MCPClient(config);
      expect(client.config).toEqual(config);
      expect(client.sessions).toEqual({});
      expect(client.activeSessions).toEqual([]);
    });
  });

  describe('test_from_dict', () => {
    it('should create from dictionary', () => {
      const config = { mcpServers: { test: { url: 'http://test.com' } } };
      const client = MCPClient.fromConfig(config);
      expect(client.config).toEqual(config);
      expect(client.sessions).toEqual({});
      expect(client.activeSessions).toEqual([]);
    });
  });

  describe('test_init_with_file_config', () => {
    it('should initialize with file config', async () => {
      const config : MCPClientConfig = { mcpServers: { test: { ws_url: 'http://test.com'} } }  ;
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
      const tempPath = path.join(tempDir, 'config.json');
      await fs.writeFile(tempPath, JSON.stringify(config));

      

      try {  
        const client = new MCPClient(config);
        expect(client.config).toEqual(config);
        expect(client.sessions).toEqual({});
        expect(client.activeSessions).toEqual([]);
      } finally {
        await fs.unlink(tempPath);
        await fs.rmdir(tempDir);
      }
    });
  });

  describe('test_from_config_file', () => {
    it('should create from config file', async () => {
      const config = { mcpServers: { test: { url: 'http://test.com' } } };
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
      const tempPath = path.join(tempDir, 'config.json');
      await fs.writeFile(tempPath, JSON.stringify(config));

      try {
        const client = await MCPClient.fromConfigFile(tempPath);
        expect(client.config).toEqual(config);
        expect(client.sessions).toEqual({});
        expect(client.activeSessions).toEqual([]);
      } finally {
        await fs.unlink(tempPath);
        await fs.rmdir(tempDir);
      }
    });
  });
});

describe('TestMCPClientServerManagement', () => {
  describe('test_add_server', () => {
    it('should add server to empty config', () => {
      const client = new MCPClient();
      const serverConfig = { url: 'http://test.com' };
      client.addServer('test', serverConfig);
      expect(client.config.mcpServers).toEqual({ test: serverConfig });
    });
  });

  describe('test_add_server_to_existing', () => {
    it('should add server to existing servers', () => {
      const config = { mcpServers: { server1: { url: 'http://server1.com' } } };
      const client = new MCPClient(config);
      const serverConfig = { url: 'http://test.com' };
      client.addServer('test', serverConfig);
      expect(client.config.mcpServers).toEqual({
        server1: { url: 'http://server1.com' },
        test: serverConfig
      });
    });
  });

  describe('test_remove_server', () => {
    it('should remove server from config', () => {
      const config = {
        mcpServers: {
          server1: { url: 'http://server1.com' },
          server2: { url: 'http://server2.com' }
        }
      };
      const client = new MCPClient(config);
      client.removeServer('server1');
      expect(client.config.mcpServers).toEqual({
        server2: { url: 'http://server2.com' }
      });
    });
  });

  describe('test_remove_server_with_active_session', () => {
    it('should remove server and active session', () => {
      const config = {
        mcpServers: {
          server1: { url: 'http://server1.com' },
          server2: { url: 'http://server2.com' }
        }
      };
      const client = new MCPClient(config);
      client.activeSessions.push('server1');
      client.removeServer('server1');
      expect(client.config.mcpServers).toEqual({
        server2: { url: 'http://server2.com' }
      });
      expect(client.activeSessions).not.toContain('server1');
    });
  });

  describe('test_get_server_names', () => {
    it('should get server names', () => {
      const config = {
        mcpServers: {
          server1: { url: 'http://server1.com' },
          server2: { url: 'http://server2.com' }
        }
      };
      const client = new MCPClient(config);
      const serverNames = client.getServerNames();
      expect(serverNames).toHaveLength(2);
      expect(serverNames).toContain('server1');
      expect(serverNames).toContain('server2');
    });
  });

  describe('test_get_server_names_empty', () => {
    it('should return empty array when no servers', () => {
      const client = new MCPClient();
      const serverNames = client.getServerNames();
      expect(serverNames).toHaveLength(0);
    });
  });
});

describe('TestMCPClientSaveConfig', () => {
  describe('test_save_config', () => {
    it('should save config to file', async () => {
      const config = { mcpServers: { server1: { url: 'http://server1.com' } } };
      const client = new MCPClient(config);
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));
      const tempPath = path.join(tempDir, 'config.json');

      try {
        await client.saveConfig(tempPath);
        const savedContent = await fs.readFile(tempPath, 'utf-8');
        const savedConfig = JSON.parse(savedContent);
        expect(savedConfig).toEqual(config);
      } finally {
        await fs.unlink(tempPath);
        await fs.rmdir(tempDir);
      }
    });
  });
});