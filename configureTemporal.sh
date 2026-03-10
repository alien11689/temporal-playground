#!/bin/bash

namespace=issue-system
temporal operator namespace create $namespace
temporal operator search-attribute create --namespace $namespace --name ProjectId --type Keyword
temporal operator search-attribute create --namespace $namespace --name IssueAuthor --type Keyword
temporal operator search-attribute create --namespace $namespace --name IssueStatus --type Keyword

