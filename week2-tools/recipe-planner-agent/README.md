# Recipe Planner Agent (Tool Composition)

## Concept
Demonstrates **tool composition** where:
- Tool output → becomes input to next tool
- Agent chains tools logically
- Results from step N inform step N+1

## Workflow
1. **plan_recipe**: Generate recipe with quantities
2. **check_ingredients**: Verify availability using recipe output
3. **calculate_production_cost**: Compute cost with actual quantities
4. **estimate_quality_score**: Assess quality based on recipe
5. **suggest_adjustments**: Recommend changes if needed

## Key Pattern
[200~Tool Application

## Real-world Applications
- Supply chain planning
- Resource allocation
- Multi-step validations
- Optimization workflows

EOF~
