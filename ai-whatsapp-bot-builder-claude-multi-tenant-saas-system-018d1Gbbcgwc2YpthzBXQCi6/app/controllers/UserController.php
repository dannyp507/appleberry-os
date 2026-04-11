<?php
// FILE: /app/controllers/UserController.php

class UserController extends Controller {
    public function index() {
        $this->requireAuth();
        require_once __DIR__ . '/../models/User.php';
        $model = new User();
        $tenantId = $this->hasRole('platform_admin') ? null : $this->getTenantId();
        $users = $model->getByTenant($tenantId);

        $tenantLookup = [];
        if ($this->hasRole('platform_admin')) {
            require_once __DIR__ . '/../models/Tenant.php';
            $tenantModel = new Tenant();
            foreach ($tenantModel->findAll([], null, 500, 0) as $tenant) {
                $tenantLookup[$tenant['id']] = $tenant['name'];
            }
        }

        $this->view('users/index', [
            'title' => 'Users',
            'users' => $users,
            'tenantLookup' => $tenantLookup
        ]);
    }

    public function create() {
        $this->requireRole(['tenant_admin', 'platform_admin']);
        $tenants = [];
        if ($this->hasRole('platform_admin')) {
            require_once __DIR__ . '/../models/Tenant.php';
            $tenantModel = new Tenant();
            $tenants = $tenantModel->findAll([], null, 500, 0);
        }

        $this->view('users/create', [
            'title' => 'Create User',
            'tenants' => $tenants
        ]);
    }

    public function store() {
        $this->requireRole(['tenant_admin', 'platform_admin']);
        $this->requireCsrf();
        require_once __DIR__ . '/../models/User.php';
        $model = new User();
        $model->createUser([
            'tenant_id' => $this->hasRole('platform_admin')
                ? (int) $this->request->post('tenant_id')
                : $this->getTenantId(),
            'name' => $this->request->post('name'),
            'email' => $this->request->post('email'),
            'password' => $this->request->post('password'),
            'role' => $this->request->post('role'),
            'status' => 'active'
        ]);
        $this->session->flash('success', 'User created successfully');
        $this->redirect('/users');
    }

    public function edit($id) {
        $this->requireRole(['tenant_admin', 'platform_admin']);
        require_once __DIR__ . '/../models/User.php';
        $model = new User();
        $user = $model->find($id, $this->getTenantId());
        if (!$user) {
            $this->session->flash('error', 'User not found');
            $this->redirect('/users');
        }
        $tenants = [];
        if ($this->hasRole('platform_admin')) {
            require_once __DIR__ . '/../models/Tenant.php';
            $tenantModel = new Tenant();
            $tenants = $tenantModel->findAll([], null, 500, 0);
        }
        $this->view('users/edit', [
            'title' => 'Edit User',
            'user' => $user,
            'tenants' => $tenants
        ]);
    }

    public function update($id) {
        $this->requireRole(['tenant_admin', 'platform_admin']);
        $this->requireCsrf();
        require_once __DIR__ . '/../models/User.php';
        $model = new User();
        $data = [
            'tenant_id' => $this->hasRole('platform_admin')
                ? (int) $this->request->post('tenant_id')
                : $this->getTenantId(),
            'name' => $this->request->post('name'),
            'email' => $this->request->post('email'),
            'role' => $this->request->post('role'),
            'status' => $this->request->post('status')
        ];
        if ($this->request->post('password')) {
            $data['password'] = password_hash($this->request->post('password'), PASSWORD_DEFAULT);
        }
        $model->update($id, $data, $this->getTenantId());
        $this->session->flash('success', 'User updated successfully');
        $this->redirect('/users');
    }

    public function delete($id) {
        $this->requireRole(['tenant_admin', 'platform_admin']);
        $this->requireCsrf();
        require_once __DIR__ . '/../models/User.php';
        $model = new User();
        $model->delete($id, $this->getTenantId());
        $this->session->flash('success', 'User deleted successfully');
        $this->redirect('/users');
    }
}
