# ============================================================
# Task Management CRUD Application
# Feature specification covering the four core CRUD operations:
# Create, Read (View), Update, and Delete tasks.
# ============================================================

@task-management @crud
Feature: Task Management CRUD
  As a registered user
  I want to create, view, update, and delete tasks
  So that I can organize and track my personal to-do work in one place

  Background:
    Given the user is authenticated with a valid account
    And the user is on the "My Tasks" dashboard


  # ----------------------------------------------------------
  # CREATE
  # ----------------------------------------------------------
  @create
  Scenario: Create a new task with a title and description
    Given the user has no task named "Book dentist appointment"
    When the user clicks the "New Task" button
    And fills in the title with "Book dentist appointment"
    And fills in the description with "Call the clinic to schedule a checkup"
    And selects the due date "2026-10-30"
    And sets the priority to "High"
    And clicks the "Save" button
    Then the task "Book dentist appointment" should be created
    And it should appear in the task list with status "To Do"
    And a success message "Task created successfully" should be displayed

  @create
  Scenario: Create a new task with only a required title
    When the user clicks the "New Task" button
    And fills in the title with "Buy groceries"
    And clicks the "Save" button
    Then the task "Buy groceries" should be created
    And it should have an empty description
    And its priority should default to "Medium"

  @create @validation
  Scenario: Create a task without a title is rejected
    When the user clicks the "New Task" button
    And leaves the title field empty
    And clicks the "Save" button
    Then the task should not be created
    And an error message "Title is required" should be displayed


  # ----------------------------------------------------------
  # READ / VIEW
  # ----------------------------------------------------------
  @view
  Scenario: View an existing task's details
    Given the following tasks exist:
      | title                | description                          | status    | priority |
      | Book dentist        | Call the clinic for a checkup       | To Do     | High     |
      | Prepare Q3 report   | Compile sales data and charts       | In Progress | Medium |
      | Water the plants    | Every other day                     | Done      | Low      |
    When the user clicks on the task "Prepare Q3 report"
    Then the task details page should be displayed
    And the title should be "Prepare Q3 report"
    And the description should be "Compile sales data and charts"
    And the status should be "In Progress"
    And the priority should be "Medium"

  @view
  Scenario: View the list of all tasks sorted by creation date
    Given the user has 3 tasks
    When the user navigates to the "My Tasks" dashboard
    Then all 3 tasks should be listed
    And the most recently created task should appear first

  @view @filter
  Scenario: Filter tasks by status
    Given the following tasks exist:
      | title              | status      |
      | Book dentist       | To Do       |
      | Prepare Q3 report  | In Progress |
      | Water the plants   | Done        |
    When the user filters the list by status "Done"
    Then only tasks with status "Done" should be listed
    And the task "Water the plants" should be visible
    And the task "Book dentist" should not be visible

  @view @notfound
  Scenario: View a task that does not exist
    When the user requests the task with id "9999"
    Then a 404 error page should be displayed
    And the message "Task not found" should be shown


  # ----------------------------------------------------------
  # UPDATE
  # ----------------------------------------------------------
  @update
  Scenario: Update an existing task's title and description
    Given the task "Buy groceries" exists
    When the user opens the task "Buy groceries"
    And clicks the "Edit" button
    And changes the title to "Buy groceries and cook dinner"
    And changes the description to "Milk, eggs, pasta, and tomatoes"
    And clicks the "Save" button
    Then the task should be updated
    And the title should be "Buy groceries and cook dinner"
    And the description should be "Milk, eggs, pasta, and tomatoes"
    And a success message "Task updated successfully" should be displayed

  @update
  Scenario: Change a task's status to done
    Given the task "Prepare Q3 report" exists with status "In Progress"
    When the user opens the task "Prepare Q3 report"
    And changes the status to "Done"
    And clicks the "Save" button
    Then the status of the task "Prepare Q3 report" should be "Done"
    And the completed timestamp should be recorded

  @update @validation
  Scenario: Update a task with an empty title is rejected
    Given the task "Buy groceries" exists
    When the user opens the task "Buy groceries"
    And clicks the "Edit" button
    And clears the title field
    And clicks the "Save" button
    Then the task should not be updated
    And an error message "Title is required" should be displayed
    And the original title "Buy groceries" should remain unchanged

  @update @notfound
  Scenario: Update a task that does not exist
    When the user sends an update request for task id "9999"
    Then a 404 error should be returned
    And no task should be modified


  # ----------------------------------------------------------
  # DELETE
  # ----------------------------------------------------------
  @delete
  Scenario: Delete an existing task
    Given the task "Water the plants" exists
    And the task list contains 1 task
    When the user opens the task "Water the plants"
    And clicks the "Delete" button
    And confirms the deletion in the confirmation dialog
    Then the task "Water the plants" should be deleted
    And the task list should contain 0 tasks
    And a success message "Task deleted successfully" should be displayed

  @delete @cancel
  Scenario: Cancel deleting a task
    Given the task "Water the plants" exists
    When the user opens the task "Water the plants"
    And clicks the "Delete" button
    And cancels the deletion in the confirmation dialog
    Then the task "Water the plants" should still exist
    And the task list should contain 1 task

  @delete @notfound
  Scenario: Delete a task that does not exist
    When the user sends a delete request for task id "9999"
    Then a 404 error should be returned
    And no task should be removed


  # ----------------------------------------------------------
  # Full CRUD lifecycle
  # ----------------------------------------------------------
  @lifecycle
  Scenario: Complete task lifecycle from creation to deletion
    Given the user has no tasks
    When the user creates a task titled "Write release notes"
    And the user updates the task status to "In Progress"
    And the user updates the task status to "Done"
    And the user deletes the task
    Then the task list should be empty
