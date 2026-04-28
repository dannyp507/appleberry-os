<?php
// FILE: /app/controllers/FlowStepController.php

class FlowStepController extends Controller {
    public function index($flowId) {
        $this->requireAuth();
        require_once __DIR__ . '/../models/FlowStep.php';
        require_once __DIR__ . '/../models/Flow.php';
        $model = new FlowStep();
        $flowModel = new Flow();
        $flow = $flowModel->find($flowId, $this->getTenantId());
        $steps = $model->getByFlow($flowId, $this->getTenantId());
        $this->view('flow_steps/index', ['title' => 'Flow Steps', 'flowId' => $flowId, 'flow' => $flow, 'steps' => $steps]);
    }

    public function create($flowId) {
        $this->requireAuth();
        require_once __DIR__ . '/../models/Flow.php';
        $flowModel = new Flow();
        $flow = $flowModel->find($flowId, $this->getTenantId());
        $this->view('flow_steps/create', ['title' => 'Create Step', 'flowId' => $flowId, 'flow' => $flow]);
    }

    public function store($flowId) {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/FlowStep.php';
        $model = new FlowStep();
        $actionConfig = $this->normalizeActionConfig();
        $model->create([
            'tenant_id' => $this->getTenantId(),
            'flow_id' => $flowId,
            'step_order' => $this->request->post('step_order'),
            'action_type' => $this->request->post('action_type'),
            'action_config' => $actionConfig
        ]);
        $this->session->flash('success', 'Step created successfully');
        $this->redirect('/flows/' . $flowId . '/steps');
    }

    public function edit($id) {
        $this->requireAuth();
        require_once __DIR__ . '/../models/FlowStep.php';
        require_once __DIR__ . '/../models/Flow.php';
        $model = new FlowStep();
        $flowModel = new Flow();
        $step = $model->find($id, $this->getTenantId());
        if (!$step) {
            $this->session->flash('error', 'Step not found');
            $this->redirect('/bots');
        }
        $flow = $flowModel->find($step['flow_id'], $this->getTenantId());
        $this->view('flow_steps/edit', ['title' => 'Edit Step', 'step' => $step, 'flow' => $flow]);
    }

    public function update($id) {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/FlowStep.php';
        $model = new FlowStep();
        $step = $model->find($id, $this->getTenantId());
        $actionConfig = $this->normalizeActionConfig();
        $model->update($id, [
            'step_order' => $this->request->post('step_order'),
            'action_type' => $this->request->post('action_type'),
            'action_config' => $actionConfig
        ], $this->getTenantId());
        $this->session->flash('success', 'Step updated successfully');
        $this->redirect('/flows/' . $step['flow_id'] . '/steps');
    }

    public function delete($id) {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/FlowStep.php';
        $model = new FlowStep();
        $step = $model->find($id, $this->getTenantId());
        $model->delete($id, $this->getTenantId());
        $this->session->flash('success', 'Step deleted successfully');
        $this->redirect('/flows/' . $step['flow_id'] . '/steps');
    }

    private function normalizeActionConfig() {
        $rawJson = $this->request->post('action_config_json');

        if ($rawJson) {
            $decoded = json_decode($rawJson, true);
            if (is_array($decoded)) {
                return json_encode($decoded);
            }
        }

        $config = [
            'message' => $this->request->post('config_message'),
            'caption' => $this->request->post('config_caption'),
            'media_url' => $this->request->post('config_media_url'),
            'question' => $this->request->post('config_question'),
            'variable' => $this->request->post('config_variable'),
            'prompt' => $this->request->post('config_prompt'),
            'key' => $this->request->post('config_key'),
            'value' => $this->request->post('config_value')
        ];

        return json_encode(array_filter($config, function ($value) {
            return $value !== null && $value !== '';
        }));
    }
}
